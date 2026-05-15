import logging
import threading

import requests
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AlarmEvent, InAppNotification, NotificationSubscription

logger = logging.getLogger(__name__)


def _post_webhook(url: str, payload: dict) -> None:
    try:
        requests.post(url, json=payload, timeout=8, headers={'Content-Type': 'application/json'})
    except Exception as exc:
        logger.warning('Webhook delivery failed: %s', exc)


def dispatch_critical_alarm_notifications(event: AlarmEvent) -> None:
    User = get_user_model()
    payload = {
        'type': 'alarm_critical',
        'alarm_event_id': event.id,
        'rule': event.rule.name,
        'tag': event.rule.tag.name,
        'severity': event.rule.severity,
        'level': event.level,
        'state': event.state,
        'value': event.triggered_value,
        'message': event.message,
    }

    staff_ids = User.objects.filter(role__in=['admin', 'operator'], is_active=True).values_list('id', flat=True)
    for uid in staff_ids:
        InAppNotification.objects.create(
            user_id=uid,
            category=InAppNotification.CATEGORY_ALARM_CRITICAL,
            title=f"Critical alarm: {event.rule.tag.name}",
            body=event.message or f'{event.rule.name} ({event.level})',
            payload={
                'alarm_event_id': event.id,
                'rule_id': event.rule_id,
                'tag_id': event.rule.tag_id,
            },
        )

    urls_sent = set()
    subs = NotificationSubscription.objects.filter(
        is_active=True,
        notify_alarm_critical=True,
        channel=NotificationSubscription.CHANNEL_WEBHOOK,
    ).exclude(destination='')

    for sub in subs:
        url = sub.destination.strip()
        if not url or url in urls_sent:
            continue
        urls_sent.add(url)
        threading.Thread(target=_post_webhook, args=(url, payload), daemon=True).start()


@receiver(post_save, sender=AlarmEvent)
def alarm_event_created_notify(sender, instance: AlarmEvent, created: bool, **kwargs):
    if not created:
        return
    if instance.rule.severity != 'critical':
        return
    dispatch_critical_alarm_notifications(instance)
