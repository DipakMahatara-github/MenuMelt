"""eSewa ePay v2 (sandbox) — signing and status check. Secrets stay server-side."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import logging
import re
from decimal import Decimal
from urllib.error import URLError, HTTPError
from urllib.parse import parse_qsl, unquote, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

ESEWA_FORM_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"

# Default when nothing else matches (prefer rc-epay — same stack as ePay v2 form).
_DEFAULT_STATUS_URL = "https://rc-epay.esewa.com.np/api/epay/transaction/status/"


def get_esewa_status_url() -> str:
    """Resolve status API base URL (trailing slash). Prefer Django settings, then default."""
    try:
        from django.conf import settings as dj_settings

        u = getattr(dj_settings, "ESEWA_STATUS_URL", None)
        if u and str(u).strip():
            base = str(u).strip().rstrip("/") + "/"
            return base
    except Exception:
        pass
    return _DEFAULT_STATUS_URL


def get_esewa_status_url_candidates() -> list[str]:
    """
    ePay v2 form is on rc-epay; the transaction record may only exist on that host's status API.
    UAT / rc hosts are tried as fallbacks. Django ESEWA_STATUS_URL is appended last if distinct.
    """
    out: list[str] = []

    def add(u: str) -> None:
        nu = str(u).strip().rstrip("/") + "/"
        if nu not in out:
            out.append(nu)

    add("https://rc-epay.esewa.com.np/api/epay/transaction/status/")
    add("https://uat.esewa.com.np/api/epay/transaction/status/")
    add("https://rc.esewa.com.np/api/epay/transaction/status/")
    try:
        from django.conf import settings as dj_settings

        cfg = getattr(dj_settings, "ESEWA_STATUS_URL", None)
        if cfg and str(cfg).strip():
            add(str(cfg).strip())
    except Exception:
        pass
    return out


# ✅ Ensure consistent formatting (VERY IMPORTANT)
def format_esewa_amount(value) -> str:
    return "{:.2f}".format(Decimal(value))


def _host_looks_like_ngrok_free(hostname: str) -> bool:
    h = (hostname or "").lower()
    if not h:
        return False
    if h.endswith("ngrok-free.app") or h.endswith("ngrok-free.dev"):
        return True
    if h.endswith("ngrok.app") or h == "ngrok.app":
        return True
    if ".ngrok.io" in h or h.endswith("ngrok.io"):
        return True
    return False


def _merge_query_params(url: str, extra: dict[str, str]) -> str:
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    for k, v in extra.items():
        if k not in q:
            q[k] = v
    new_query = urlencode(q)
    return urlunparse(
        (parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment)
    )


def build_esewa_return_urls(base: str, *, order_id: int | None = None) -> tuple[str, str, list[str]]:
    """
    Build success_url and failure_url for ePay v2.

    ``order_id`` is embedded so the SPA can verify payment even when eSewa omits
    ``data`` / ``transaction_uuid`` on the redirect (common with some tunnels or clients).

    Free ngrok hosts serve a browser-warning / bot interstitial. eSewa may probe
    return URLs when you confirm payment; if that check fails, PAY VIA ESEWA errors
    before MPIN. We append ngrok's skip flag for browser returns and surface a warning.
    """
    base = (base or "").strip().rstrip("/")
    warnings: list[str] = []
    success_url = f"{base}/payment/esewa/success"
    failure_url = f"{base}/payment/esewa/failure"
    host = (urlparse(base).hostname or "").lower()

    extra: dict[str, str] = {}
    if order_id is not None:
        extra["order_id"] = str(int(order_id))
    if _host_looks_like_ngrok_free(host):
        extra["ngrok-skip-browser-warning"] = "true"
        warnings.append(
            "Free ngrok URLs are often rejected when eSewa validates your return URLs "
            "(Pay via eSewa can fail before MPIN). Prefer Cloudflare Tunnel, paid ngrok, "
            "or a real HTTPS deployment for FRONTEND_URL."
        )
    if extra:
        success_url = _merge_query_params(success_url, extra)
        failure_url = _merge_query_params(failure_url, extra)
    return success_url, failure_url, warnings


def decode_esewa_return_data_payload(raw: str) -> dict:
    """
    Decode eSewa success redirect `data` query/body value (base64-encoded JSON).
    Returns {} on any failure (caller treats as missing).
    """
    if not raw or not isinstance(raw, str):
        return {}
    s = unquote(raw.strip())
    if not s:
        return {}

    def _pad(b64: str) -> str:
        pad = (-len(b64)) % 4
        return b64 + ("=" * pad) if pad else b64

    blob: bytes | None = None
    for fn in (base64.urlsafe_b64decode, base64.b64decode):
        try:
            blob = fn(_pad(s).encode("ascii"), validate=False)
            break
        except (ValueError, binascii.Error):
            continue
    if blob is None:
        logger.warning("eSewa data param: base64 decode failed (len=%s)", len(s))
        return {}

    try:
        text = blob.decode("utf-8")
        obj = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        logger.warning("eSewa data param: UTF-8/JSON parse failed: %s", e)
        return {}

    return obj if isinstance(obj, dict) else {}


def extract_esewa_redirect_fields(decoded: dict) -> tuple[str, str, str]:
    """
    Pull transaction_uuid, total_amount, product_code from decoded eSewa payload.
    Handles a few key variants and one level of nesting.
    """
    if not decoded:
        return "", "", ""

    def pick(d: dict, *keys: str) -> str:
        for k in keys:
            v = d.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""

    txn = pick(decoded, "transaction_uuid", "transactionUuid", "uuid")
    amt = pick(decoded, "total_amount", "totalAmount", "amount")
    code = pick(decoded, "product_code", "productCode", "merchant_id", "merchantId")

    nested = decoded.get("transaction_detail") or decoded.get("transactionDetail")
    if isinstance(nested, dict):
        if not txn:
            txn = pick(nested, "transaction_uuid", "transactionUuid", "uuid")
        if not amt:
            amt = pick(nested, "total_amount", "totalAmount", "amount")
        if not code:
            code = pick(nested, "product_code", "productCode")

    return txn, amt, code


# ✅ Correct signature generation (STRICT format)
def build_signature(secret_key: str, message: str) -> str:
    digest = hmac.new(
        secret_key.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


_TXN_UUID_PATTERN = re.compile(r"^[A-Za-z0-9-]+$")

REQUIRED_EPAY_V2_FORM_KEYS = (
    "amount",
    "tax_amount",
    "total_amount",
    "transaction_uuid",
    "product_code",
    "product_service_charge",
    "product_delivery_charge",
    "success_url",
    "failure_url",
    "signed_field_names",
    "signature",
)


def validate_transaction_uuid(value: str) -> None:
    s = (value or "").strip()
    if not s:
        raise ValueError("transaction_uuid is required")
    if len(s) > 128:
        raise ValueError("transaction_uuid exceeds 128 characters")
    if not _TXN_UUID_PATTERN.match(s):
        raise ValueError(
            "transaction_uuid must contain only letters, digits, and hyphen (per eSewa)"
        )


def validate_epay_v2_form_fields(fields: dict) -> None:
    """Ensure all mandatory ePay v2 fields are present and total_amount matches the breakdown."""
    for key in REQUIRED_EPAY_V2_FORM_KEYS:
        raw = fields.get(key)
        if raw is None or str(raw).strip() == "":
            raise ValueError(f"Missing or empty required eSewa field: {key}")

    expected_signed = "total_amount,transaction_uuid,product_code"
    if str(fields["signed_field_names"]).strip() != expected_signed:
        raise ValueError("signed_field_names must be exactly " + repr(expected_signed))

    q = lambda x: Decimal(str(x)).quantize(Decimal("0.01"))
    amount = q(fields["amount"])
    tax = q(fields["tax_amount"])
    service = q(fields["product_service_charge"])
    delivery = q(fields["product_delivery_charge"])
    total = q(fields["total_amount"])
    if amount + tax + service + delivery != total:
        raise ValueError(
            "total_amount must equal amount + tax_amount + product_service_charge "
            f"+ product_delivery_charge (got total={total}, parts sum={amount + tax + service + delivery})"
        )


def build_form_fields(
    *,
    secret_key: str,
    merchant_id: str,
    total_amount: Decimal,
    transaction_uuid: str,
    success_url: str,
    failure_url: str,
) -> dict:
    """Return POST body fields for the eSewa v2 form endpoint."""

    secret_key = (secret_key or "").strip()
    merchant_id = (merchant_id or "").strip()
    transaction_uuid = str(transaction_uuid or "").strip()
    success_url = str(success_url or "").strip()
    failure_url = str(failure_url or "").strip()

    if not secret_key:
        raise ValueError("eSewa secret_key is empty")
    if not merchant_id:
        raise ValueError("eSewa product_code (merchant_id) is empty")

    validate_transaction_uuid(transaction_uuid)

    # Per eSewa: total_amount = amount + tax_amount + product_service_charge + product_delivery_charge
    amount_s = format_esewa_amount(total_amount)
    tax_s = "0"
    service_s = "0"
    delivery_s = "0"
    total_computed = (
        Decimal(amount_s)
        + Decimal(tax_s)
        + Decimal(service_s)
        + Decimal(delivery_s)
    )
    total_s = format_esewa_amount(total_computed)

    signed_field_names = "total_amount,transaction_uuid,product_code"
    # Official format: no spaces after commas (see developer.esewa.com.np Epay-V2)
    message = (
        f"total_amount={total_s},transaction_uuid={transaction_uuid},product_code={merchant_id}"
    )
    signature = build_signature(secret_key, message)
    logger.info("eSewa HMAC message (exact bytes UTF-8): %s", message)

    fields = {
        "amount": amount_s,
        "tax_amount": tax_s,
        "total_amount": total_s,
        "transaction_uuid": transaction_uuid,
        "product_code": merchant_id,
        "product_service_charge": service_s,
        "product_delivery_charge": delivery_s,
        "success_url": success_url,
        "failure_url": failure_url,
        "signed_field_names": signed_field_names,
        "signature": signature,
    }
    validate_epay_v2_form_fields(fields)
    return fields


def _fetch_transaction_status_at_base(
    *,
    status_base_url: str,
    merchant_id: str,
    transaction_uuid: str,
    total_s: str,
) -> tuple[dict, str, str]:
    """Single GET to one status host. Returns (parsed, raw, full_url)."""
    base = str(status_base_url).strip().rstrip("/") + "/"
    params = urlencode(
        {
            "product_code": merchant_id,
            "total_amount": total_s,
            "transaction_uuid": transaction_uuid,
        }
    )
    full_url = f"{base}?{params}"
    req = Request(full_url, headers={"Accept": "application/json"})
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except HTTPError as e:
        raw = e.read().decode("utf-8") if e.fp else ""
        raise ValueError(f"eSewa status HTTP {e.code}: {raw}") from e
    except URLError as e:
        raise ValueError(f"eSewa status request failed: {e}") from e

    if not raw.strip():
        parsed: dict = {}
    else:
        try:
            obj = json.loads(raw)
            parsed = obj if isinstance(obj, dict) else {}
        except json.JSONDecodeError:
            logger.warning("eSewa status API non-JSON body: %r", raw[:2000])
            parsed = {}
    return parsed, raw, full_url


# ✅ STATUS CHECK — tries rc-epay + UAT + rc + configured URL (sandbox transactions differ by host)
def fetch_transaction_status(
    *,
    merchant_id: str,
    transaction_uuid: str,
    total_amount: Decimal | None = None,
    total_amount_str: str | None = None,
) -> tuple[dict, str, str]:
    """
    Call eSewa status API on each known sandbox host until definitive success/failure
    or all hosts are exhausted.

    Prefer total_amount_str (e.g. from Order.esewa_pay_total_amount) so the query matches
    the signed payment request exactly. Otherwise formats total_amount.

    Returns (parsed_json, raw_body, full_url). On empty or non-JSON body, parsed is {}.
    Raises ValueError only if every host fails with transport/HTTP errors.
    """
    if total_amount_str is not None and str(total_amount_str).strip():
        total_s = str(total_amount_str).strip()
    elif total_amount is not None:
        total_s = format_esewa_amount(total_amount)
    else:
        raise ValueError("total_amount or total_amount_str is required for eSewa status")

    last_error: ValueError | None = None
    last_payload: dict = {}
    last_raw = ""
    last_url = ""

    for status_base in get_esewa_status_url_candidates():
        try:
            parsed, raw, full_url = _fetch_transaction_status_at_base(
                status_base_url=status_base,
                merchant_id=merchant_id,
                transaction_uuid=transaction_uuid,
                total_s=total_s,
            )
        except ValueError as e:
            last_error = e
            logger.warning("eSewa status skip host=%s: %s", status_base, e)
            continue

        last_payload, last_raw, last_url = parsed, raw, full_url
        outcome = classify_esewa_transaction_status(parsed)
        logger.info(
            "eSewa status try url=%s classified=%s keys=%s",
            full_url,
            outcome,
            list(parsed.keys()) if parsed else None,
        )
        if outcome in ("success", "failed"):
            return parsed, raw, full_url

    if last_error is not None and not last_payload and not last_raw:
        raise last_error
    return last_payload, last_raw, last_url


def classify_esewa_transaction_status(payload: dict) -> str:
    """
    Map eSewa transaction status JSON to outcome for verification.

    Returns one of: "success", "pending", "not_found", "failed".
    Empty body / unknown shapes → "pending" (retry).
    NOT_FOUND → "not_found" (retry; possible uuid/amount mismatch — do not mark paid).
    """
    if not isinstance(payload, dict) or not payload:
        return "pending"

    status = (
        payload.get("status")
        or payload.get("transaction_status")
        or payload.get("transactionStatus")
        or ""
    )
    status_u = str(status).strip().upper()

    if status_u in ("COMPLETE", "SUCCESS", "COMPLETED"):
        return "success"
    if status_u == "PENDING":
        return "pending"
    if status_u == "NOT_FOUND":
        return "not_found"
    if status_u in ("FAILED", "FAIL", "CANCELLED", "CANCELED", "REFUNDED"):
        return "failed"

    # Some error-style bodies without a normalized status field
    code = str(payload.get("code") or payload.get("error_key") or "").upper()
    msg = str(payload.get("message") or payload.get("error") or "").upper()
    if "NOT_FOUND" in code or "NOT_FOUND" in msg or "NOT FOUND" in msg:
        return "not_found"

    return "pending"


def status_indicates_success(payload: dict) -> bool:
    return classify_esewa_transaction_status(payload) == "success"