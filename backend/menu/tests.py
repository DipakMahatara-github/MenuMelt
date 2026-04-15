from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from menu.models import MenuCategory, MenuItem, MenuOffer, MenuOfferItem
from restaurants.models import Restaurant
from tables.models import Table


class MenuOfferVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin_user = User.objects.create_user(
            email="owner@example.com",
            password="password123",
            full_name="Owner",
            role="restaurant_admin",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.admin_user,
            name="Local Garden",
            address="Kathmandu",
        )
        self.admin_user.restaurant = self.restaurant
        self.admin_user.save(update_fields=["restaurant"])

        self.category = MenuCategory.objects.create(
            restaurant=self.restaurant,
            name="Mains",
            sort_order=0,
        )
        self.item = MenuItem.objects.create(
            restaurant=self.restaurant,
            category=self.category,
            name="Kothey MoMo",
            price=Decimal("350.00"),
            is_available=True,
        )
        self.offer = MenuOffer.objects.create(
            restaurant=self.restaurant,
            name="Lunch Saver",
            offer_type=MenuOffer.TYPE_FIXED,
            badge_text="Lunch deal",
            is_active=True,
            starts_at=timezone.now() - timedelta(hours=1),
            fixed_discount_amount=Decimal("50.00"),
        )
        MenuOfferItem.objects.create(
            offer=self.offer,
            menu_item=self.item,
            quantity=1,
        )
        self.table = Table.objects.create(restaurant=self.restaurant, number=1)

    def test_admin_menu_list_includes_offer_badges_and_discounted_price(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/menu/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["customer_price"], "300.00")
        self.assertEqual(payload[0]["offer_badges"][0]["label"], "Lunch deal")

    def test_customer_menu_response_includes_special_offer_section(self):
        response = self.client.get(
            "/api/menu/",
            HTTP_X_TABLE_TOKEN=str(self.table.qr_code),
            HTTP_X_SESSION_ID="session-1",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["special_offers"][0]["name"], "Lunch Saver")
        self.assertEqual(payload["items"][0]["offer_badges"][0]["label"], "Lunch deal")

    def test_offer_update_keeps_existing_offer_items_instead_of_creating_duplicates(self):
        self.client.force_authenticate(user=self.admin_user)
        offer_item = self.offer.items.first()

        response = self.client.put(
            f"/api/menu/offers/{self.offer.id}/",
            {
                "name": "Lunch Saver",
                "offer_type": "fixed",
                "badge_text": "Lunch deal",
                "description": "Updated copy",
                "is_active": True,
                "starts_at": self.offer.starts_at.isoformat().replace("+00:00", "Z"),
                "ends_at": None,
                "fixed_discount_amount": "75.00",
                "percentage_discount": None,
                "combo_price": None,
                "items_payload": [
                    {
                        "id": offer_item.id,
                        "menu_item": self.item.id,
                        "quantity": 2,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.items.count(), 1)
        self.assertEqual(self.offer.items.first().quantity, 2)
