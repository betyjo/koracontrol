import logging
import threading

import requests
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AlarmEvent, InAppNotification, NotificationSubscription, TagLog
from .mqtt_service import publish_alarm_notification, publish_tag_update

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


@receiver(post_save, sender=TagLog)
def taglog_created_publish_to_mqtt(sender, instance: TagLog, created: bool, **kwargs):
    """Publish tag updates to MQTT for real-time SCADA integration"""
    if not created:
        return
    
    tag_name = instance.tag.name
    value = instance.value
    timestamp = instance.timestamp.isoformat() if instance.timestamp else None
    
    # Publish to MQTT in a separate thread to avoid blocking
    threading.Thread(
        target=publish_tag_update, 
        args=(tag_name, value, timestamp), 
        daemon=True
    ).start()
    
    # Trigger automatic AI analysis in a separate thread
    threading.Thread(
        target=_run_ai_analysis_for_taglog, 
        args=(instance,), 
        daemon=True
    ).start()


def _run_ai_analysis_for_taglog(taglog: TagLog) -> None:
    """Run AI analysis for a newly created tag log"""
    try:
        from .ai_service import run_anomaly_detection
        from .models import AIAnalysis
        
        # Get recent data for this tag (include the new log)
        recent_data = taglog.tag.logs.order_by('-timestamp')[:10]
        
        if len(recent_data) >= 3:  # Only run analysis if we have enough data
            # Run the AI service
            is_anomaly, confidence, explanation = run_anomaly_detection(list(recent_data))
            
            # Save the analysis
            AIAnalysis.objects.create(
                tag=taglog.tag,
                is_anomaly=is_anomaly,
                confidence_score=confidence,
                explanation=explanation
            )
            
            logger.info(f"AI Analysis completed for tag {taglog.tag.name}: anomaly={is_anomaly}, confidence={confidence}")
            
            # Publish AI analysis to MQTT if it's an anomaly
            if is_anomaly:
                from .mqtt_service import mqtt_service
                ai_payload = {
                    "type": "anomaly",
                    "source": "backend_ai",
                    "message": explanation,
                    "tag_name": taglog.tag.name,
                    "tag_id": taglog.tag.id,
                    "sensor_value": taglog.value,
                    "is_anomaly": True,
                    "confidence": round(confidence, 2),
                    "timestamp": taglog.timestamp.isoformat() if taglog.timestamp else None
                }
                mqtt_service.publish_ai_analysis(ai_payload)
                
    except Exception as e:
        logger.error(f"AI Analysis failed for tag log {taglog.id}: {e}")