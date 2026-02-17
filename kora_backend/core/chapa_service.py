import requests
from django.conf import settings

# In a real app, these should be in settings.py and env vars
CHAPA_SECRET_KEY = "CHASECK_TEST-oeGHVQDxyysSLRicqB7pmh2WLSa7iqXE" 
CHAPA_URL = "https://api.chapa.co/v1/transaction/initialize"

def initialize_chapa_payment(transaction):
    """
    Sends payment details to Chapa and gets a checkout URL.
    """
    headers = {
        'Authorization': f'Bearer {CHAPA_SECRET_KEY}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        "amount": str(transaction.amount),
        "currency": "ETB",
        "email": transaction.user.email,
        "first_name": transaction.user.username,
        "last_name": "Customer",
        "tx_ref": transaction.tx_ref,
        "callback_url": "http://127.0.0.1:8000/api/payments/callback/", # Your webhook
        "return_url": "http://localhost:3000/payment-success/", # Customer's frontend
        "customization[title]": "Kora Control Bill Payment",
        "customization[description]": f"Payment for Bill ID: {transaction.bill.id}"
    }

    response = requests.post(CHAPA_URL, json=payload, headers=headers)
    return response.json()
