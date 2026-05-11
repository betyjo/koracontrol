import logging
from decimal import Decimal

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DEFAULT_CHAPA_URL = "https://api.chapa.co/v1/transaction/initialize"


class ChapaConfigurationError(RuntimeError):
    """Missing API key / env so we cannot speak to Chapa."""


class ChapaRequestError(RuntimeError):
    """Network or invalid response body from Chapa."""


def _chapa_secret() -> str:
    return str(getattr(settings, "CHAPA_SECRET_KEY", "") or "").strip()


def initialize_chapa_payment(payment_transaction, *, callback_url: str, return_url: str):
    """
    Initialize a Chapa-hosted checkout session.
    Raises ChapaConfigurationError / ChapaRequestError on failures.
    """
    secret = str(_chapa_secret()).strip()

    endpoint = getattr(settings, "CHAPA_INIT_URL", DEFAULT_CHAPA_URL).strip()

    user = payment_transaction.user
    email = (user.email or "").strip() or None
    if not email:
        email = f"{user.username.strip() or 'user'}@noreply.kora.local"

    payload = {
        "amount": str(Decimal(str(payment_transaction.amount))),
        "currency": getattr(settings, "CHAPA_CURRENCY", "ETB"),
        "email": email,
        "first_name": user.first_name.strip() if user.first_name else user.username[:30],
        "last_name": (user.last_name.strip() if user.last_name else "Customer")[:80],
        "tx_ref": str(payment_transaction.tx_ref),
        "callback_url": callback_url,
        "return_url": return_url,
        "customization[title]": "Kora Control Bill Payment",
        "customization[description]": f"Payment for Bill ID: {payment_transaction.bill_id}",
    }

    if settings.DEBUG and not secret:
        logger.warning(
            "CHAPA_SECRET_KEY is unset; returning mock checkout (DEBUG only)."
        )
        sep = "&" if "?" in return_url else "?"
        return {
            "message": "Mock checkout (missing CHAPA_SECRET_KEY)",
            "status": "success",
            "data": {
                "checkout_url": f"{return_url}{sep}mockPay=1&tx_ref={payment_transaction.tx_ref}"
            },
        }

    if not secret:
        raise ChapaConfigurationError(
            "Chapa secret key missing. Set CHAPA_SECRET_KEY in the environment "
            "(or temporarily run with DEBUG=true for mock redirect)."
        )

    headers = {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(
            endpoint, json=payload, headers=headers, timeout=getattr(settings, "CHAPA_TIMEOUT_SECONDS", 20)
        )
    except requests.RequestException as exc:
        logger.exception("Chapa network error")
        raise ChapaRequestError("Could not reach Chapa.") from exc

    try:
        body = response.json()
    except ValueError:
        snippet = response.text[:500] if response.text else "(empty)"
        logger.error("Chapa non-JSON response (status=%s): %s", response.status_code, snippet)
        raise ChapaRequestError("Chapa returned an invalid response (not JSON).")

    status = body.get("status")
    checkout = (body.get("data") or {}).get("checkout_url")

    if response.status_code >= 400 or status != "success":
        logger.warning(
            "Chapa init rejected: http=%s status=%s body=%s",
            response.status_code,
            status,
            body,
        )

    if status != "success" or not checkout:
        message = (
            body.get("message")
            or body.get("error")
            or f"HTTP {response.status_code}"
        )
        raise ChapaRequestError(str(message))

    return body
