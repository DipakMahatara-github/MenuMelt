from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Prefetch, Q
from django.utils import timezone
from rest_framework import serializers

from .models import MenuItem, MenuItemCustomizationGroup, MenuItemCustomizationOption, MenuOffer, MenuOfferItem

MONEY_PLACES = Decimal("0.01")
NEW_ITEM_WINDOW_DAYS = 14
POPULAR_MIN_ORDERED_QTY = 3


def quantize_money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(value).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def active_offer_queryset(restaurant_id: int, now=None):
    now = now or timezone.now()
    return (
        MenuOffer.objects.filter(restaurant_id=restaurant_id, is_active=True)
        .filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now))
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        .prefetch_related(
            Prefetch(
                "items",
                queryset=MenuOfferItem.objects.select_related("menu_item").order_by("id"),
            )
        )
    )


def _badge_label(offer: MenuOffer) -> str:
    if (offer.badge_text or "").strip():
        return offer.badge_text.strip()
    if offer.offer_type == MenuOffer.TYPE_FIXED:
        amount = quantize_money(offer.fixed_discount_amount or 0)
        return f"Save Rs. {amount}"
    if offer.offer_type == MenuOffer.TYPE_PERCENTAGE:
        pct = Decimal(offer.percentage_discount or 0).normalize()
        return f"{pct}% off"
    return "Special meal"


def build_offer_context(menu_items, offers):
    item_ids = {item.id for item in menu_items}
    context = {
        item_id: {
            "effective_price": quantize_money(item.price),
            "item_offer": None,
            "badges": [],
            "combo_badges": [],
        }
        for item_id, item in ((item.id, item) for item in menu_items)
    }

    for offer in offers:
        links = [link for link in offer.items.all() if link.menu_item_id in item_ids]
        if not links:
            continue

        badge = {
            "id": offer.id,
            "label": _badge_label(offer),
            "offer_type": offer.offer_type,
            "name": offer.name,
        }

        if offer.offer_type == MenuOffer.TYPE_COMBO:
            for link in links:
                context[link.menu_item_id]["combo_badges"].append(badge)
                context[link.menu_item_id]["badges"].append(badge)
            continue

        for link in links:
            base_price = quantize_money(link.menu_item.price)
            if offer.offer_type == MenuOffer.TYPE_FIXED:
                discounted = max(Decimal("0.00"), base_price - quantize_money(offer.fixed_discount_amount or 0))
            else:
                percentage = Decimal(offer.percentage_discount or 0)
                discounted = quantize_money(base_price * (Decimal("100.00") - percentage) / Decimal("100.00"))

            current = context[link.menu_item_id]
            current["badges"].append(badge)
            if discounted < current["effective_price"]:
                current["effective_price"] = discounted
                current["item_offer"] = {
                    **badge,
                    "offer": offer,
                    "discounted_price": discounted,
                    "base_price": base_price,
                }

    for item_context in context.values():
        item_context["badges"] = sorted(
            {f"{badge['offer_type']}::{badge['label']}": badge for badge in item_context["badges"]}.values(),
            key=lambda badge: (badge["offer_type"], badge["label"]),
        )

    return context


def _validate_selected_options(menu_item: MenuItem, selected_option_ids):
    option_lookup = {}
    group_lookup = {}
    for group in menu_item.customization_groups.all():
        group_lookup[group.id] = group
        for option in group.options.all():
            option_lookup[option.id] = option

    invalid_ids = [option_id for option_id in selected_option_ids if option_id not in option_lookup]
    if invalid_ids:
        raise serializers.ValidationError(
            {"items": [f"{menu_item.name}: invalid customization option selection."]}
        )

    selections_by_group = defaultdict(list)
    for option_id in selected_option_ids:
        option = option_lookup[option_id]
        selections_by_group[option.group_id].append(option)

    for group in menu_item.customization_groups.all():
        selected = selections_by_group.get(group.id, [])
        if group.is_required and not selected:
            raise serializers.ValidationError({"items": [f"{menu_item.name}: {group.name} is required."]})
        if group.selection_mode == MenuItemCustomizationGroup.MODE_SINGLE and len(selected) > 1:
            raise serializers.ValidationError(
                {"items": [f"{menu_item.name}: choose only one option for {group.name}."]}
            )
        if group.selection_mode == MenuItemCustomizationGroup.MODE_MULTIPLE and len(selected) > group.max_select:
            raise serializers.ValidationError(
                {"items": [f"{menu_item.name}: choose at most {group.max_select} options for {group.name}."]}
            )

    selected_options = []
    customization_total = Decimal("0.00")
    for group in menu_item.customization_groups.all():
        for option in selections_by_group.get(group.id, []):
            delta = quantize_money(option.price_delta or 0)
            customization_total += delta
            selected_options.append(
                {
                    "option_id": option.id,
                    "customization_option": option,
                    "group_name": group.name,
                    "option_name": option.name,
                    "price_delta": delta,
                }
            )

    return {
        "selected_options": selected_options,
        "customization_total": quantize_money(customization_total),
    }


def quote_order_lines(*, restaurant_id: int, menu_items_by_id: dict[int, MenuItem], items_in: list[dict], offers):
    offer_context = build_offer_context(menu_items_by_id.values(), offers)
    aggregated_qty = defaultdict(int)
    regular_price_by_item_id = {}
    remaining_qty = defaultdict(int)
    line_results = []
    item_offer_totals = defaultdict(lambda: {"offer": None, "discount_amount": Decimal("0.00")})

    subtotal = Decimal("0.00")

    for row in items_in:
        menu_item = menu_items_by_id[row["menu_item"]]
        quantity = int(row["quantity"])
        selection_data = _validate_selected_options(menu_item, row.get("selected_option_ids") or [])
        item_offer = offer_context[menu_item.id]["item_offer"]
        base_menu_price = quantize_money(menu_item.price)
        raw_unit_price = quantize_money(base_menu_price + selection_data["customization_total"])
        base_unit_price = quantize_money(offer_context[menu_item.id]["effective_price"])
        unit_price = quantize_money(base_unit_price + selection_data["customization_total"])
        line_total = quantize_money(unit_price * quantity)
        subtotal += quantize_money(raw_unit_price * quantity)

        if item_offer and base_menu_price > base_unit_price:
            item_offer_totals[item_offer["id"]]["offer"] = item_offer
            item_offer_totals[item_offer["id"]]["discount_amount"] += quantize_money(
                (base_menu_price - base_unit_price) * quantity
            )

        aggregated_qty[menu_item.id] += quantity
        remaining_qty[menu_item.id] += quantity
        regular_price_by_item_id[menu_item.id] = base_unit_price

        line_results.append(
            {
                "menu_item": menu_item,
                "quantity": quantity,
                "base_menu_price": base_menu_price,
                "raw_unit_price": raw_unit_price,
                "base_unit_price": base_unit_price,
                "unit_price": unit_price,
                "line_total": line_total,
                "selected_options": selection_data["selected_options"],
                "item_offer": item_offer,
            }
        )

    applied_offers = []
    discount_total = Decimal("0.00")

    for item_offer_data in item_offer_totals.values():
        if not item_offer_data["offer"]:
            continue
        discount_amount = quantize_money(item_offer_data["discount_amount"])
        if discount_amount <= 0:
            continue
        discount_total += discount_amount
        applied_offers.append(
            {
                "offer": item_offer_data["offer"],
                "name": item_offer_data["offer"]["name"],
                "badge_text": item_offer_data["offer"]["label"],
                "offer_type": item_offer_data["offer"]["offer_type"],
                "discount_amount": discount_amount,
            }
        )

    combo_candidates = []
    for offer in offers:
        if offer.offer_type != MenuOffer.TYPE_COMBO:
            continue
        links = list(offer.items.all())
        if not links:
            continue
        if any(link.menu_item_id not in aggregated_qty for link in links):
            continue

        bundle_regular_total = Decimal("0.00")
        for link in links:
            bundle_regular_total += regular_price_by_item_id.get(link.menu_item_id, Decimal("0.00")) * link.quantity

        bundle_regular_total = quantize_money(bundle_regular_total)
        bundle_discount = quantize_money(bundle_regular_total - quantize_money(offer.combo_price or 0))
        if bundle_discount <= 0:
            continue
        combo_candidates.append((bundle_discount, offer))

    combo_candidates.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)

    for bundle_discount, offer in combo_candidates:
        links = list(offer.items.all())
        bundle_count = min(
            (remaining_qty.get(link.menu_item_id, 0) // max(1, link.quantity))
            for link in links
        )
        if bundle_count < 1:
            continue

        discount_amount = quantize_money(bundle_discount * bundle_count)
        for link in links:
            remaining_qty[link.menu_item_id] -= link.quantity * bundle_count

        discount_total += discount_amount
        applied_offers.append(
            {
                "offer": offer,
                "name": offer.name,
                "badge_text": _badge_label(offer),
                "offer_type": offer.offer_type,
                "discount_amount": discount_amount,
            }
        )

    subtotal = quantize_money(subtotal)
    discount_total = quantize_money(discount_total)
    
    # 13% VAT calculation
    taxable_amount = max(Decimal("0.00"), subtotal - discount_total)
    tax_total = quantize_money(taxable_amount * Decimal("0.13"))
    total_price = quantize_money(taxable_amount + tax_total)

    return {
        "lines": line_results,
        "subtotal_price": subtotal,
        "discount_total": discount_total,
        "tax_total": tax_total,
        "total_price": total_price,
        "applied_offers": applied_offers,
        "offer_context": offer_context,
    }
