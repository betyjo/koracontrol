"""Build absolute URLs into the Next.js customer portal (used from Django Admin)."""

from urllib.parse import urlencode

from django.conf import settings


def _portal_base() -> str:
    return getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


def billing_url(*, bill_id=None, tx_ref=None) -> str:
    base = f"{_portal_base()}/dashboard/billing"
    q = {}
    if bill_id is not None:
        q["billId"] = int(bill_id)
    if tx_ref:
        q["txRef"] = str(tx_ref)
    return f"{base}?{urlencode(q)}" if q else base


def complaints_url(*, complaint_id=None) -> str:
    base = f"{_portal_base()}/dashboard/complaints"
    if complaint_id is not None:
        return f"{base}?{urlencode({'complaintId': int(complaint_id)})}"
    return base


def analytics_url(*, analysis_id=None) -> str:
    base = f"{_portal_base()}/dashboard/analytics"
    if analysis_id is not None:
        return f"{base}?{urlencode({'analysisId': int(analysis_id)})}"
    return base
