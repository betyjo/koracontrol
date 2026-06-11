import logging
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal
from .models import User, Bill, TagLog

logger = logging.getLogger(__name__)

def generate_monthly_bills():
    """
    Background job to generate bills for customers based on SCADA meter usage.
    """
    logger.info("Starting monthly billing generation job...")
    now = timezone.now()
    thirty_days_ago = now - timedelta(days=30)
    
    customers = User.objects.filter(role='customer', meter_tag__isnull=False)
    
    bills_created = 0
    for customer in customers:
        # Check if a bill already exists for this month to avoid duplicates
        if Bill.objects.filter(user=customer, billing_date__month=now.month, billing_date__year=now.year).exists():
            logger.info(f"Bill already exists for {customer.username} this month. Skipping.")
            continue
            
        # Get latest reading
        latest_log = TagLog.objects.filter(tag=customer.meter_tag).order_by('-timestamp').first()
        # Get reading from ~30 days ago (or the oldest reading if none older than 30 days)
        old_log = TagLog.objects.filter(tag=customer.meter_tag, timestamp__lte=thirty_days_ago).order_by('-timestamp').first()
        
        if not old_log:
            # If no reading from 30 days ago, use the oldest reading available
            old_log = TagLog.objects.filter(tag=customer.meter_tag).order_by('timestamp').first()
            
        if not latest_log or not old_log or latest_log == old_log:
            logger.info(f"Not enough data to calculate usage for {customer.username}. Skipping.")
            continue
            
        latest_val = latest_log.value
        old_val = old_log.value
        
        usage = max(0, latest_val - old_val)
        amount = Decimal(usage) * customer.billing_rate
        
        if amount > 0:
            Bill.objects.create(
                user=customer,
                amount=amount,
                usage_kwh=usage,
            )
            bills_created += 1
            logger.info(f"Created bill for {customer.username}: {usage} units, Amount: {amount}")
            
    logger.info(f"Finished billing cycle. Created {bills_created} bills.")
