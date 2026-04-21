import requests
import json
import logging
from urllib.parse import urlparse
from django.conf import settings

logger = logging.getLogger(__name__)


def resolve_frontend_base(request=None):
    candidates = []
    if request is not None:
        candidates.extend(
            [
                request.headers.get("Origin"),
                request.headers.get("Referer"),
            ]
        )
    candidates.append(getattr(settings, "FRONTEND_URL", None))

    for raw in candidates:
        if not raw:
            continue
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    return ""

def get_khalti_headers(secret_key=None):
    if secret_key is None:
        secret_key = getattr(settings, "KHALTI_SECRET_KEY", "")
    return {
        "Authorization": f"Key {secret_key}",
        "Content-Type": "application/json",
    }

def initiate_khalti_payment(
    order_id,
    amount_npr,
    purchase_order_name,
    return_url,
    secret_key=None,
    website_url=None,
):
    """
    Call Khalti /epayment/initiate/
    amount_npr: Decimal or float
    """
    url = f"{settings.KHALTI_BASE_URL.rstrip('/')}/epayment/initiate/"
    
    # Amount in paisa
    amount_paisa = int(float(amount_npr) * 100)
    
    payload = {
        "return_url": return_url,
        "website_url": website_url or settings.FRONTEND_URL,
        "amount": amount_paisa,
        "purchase_order_id": str(order_id),
        "purchase_order_name": purchase_order_name,
    }
    
    headers = get_khalti_headers(secret_key=secret_key)
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        logger.error(f"Khalti initiate failed: {response.text}")
        raise ValueError(f"Khalti initiation failed: {response.text}")
    except Exception as e:
        logger.error(f"Khalti initiate exception: {str(e)}")
        raise e

def verify_khalti_payment(pidx, secret_key=None):
    """
    Call Khalti /epayment/lookup/
    """
    url = f"{settings.KHALTI_BASE_URL.rstrip('/')}/epayment/lookup/"
    
    payload = {
        "pidx": pidx
    }
    
    headers = get_khalti_headers(secret_key=secret_key)
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        logger.error(f"Khalti lookup failed: {response.text}")
        raise ValueError(f"Khalti lookup failed: {response.text}")
    except Exception as e:
        logger.error(f"Khalti lookup exception: {str(e)}")
        raise e
