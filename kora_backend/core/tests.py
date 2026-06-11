from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from core.models import Tag, TagLog, AlarmRule, AlarmEvent
from core.jobs import purge_old_taglogs

class TagLogPurgeTestCase(TestCase):
    def test_purge_old_taglogs(self):
        # 1. Setup Tags
        tag_default = Tag.objects.create(name="TagDefault", data_type="float")
        tag_short = Tag.objects.create(name="TagShort", data_type="float", retention_days=10)
        tag_long = Tag.objects.create(name="TagLong", data_type="float", retention_days=60)
        
        now = timezone.now()
        
        # 2. Create TagLogs for tag_default (default retention = 30 days)
        # Log 1: 35 days old (should be purged)
        log1 = TagLog.objects.create(tag=tag_default, value=25.0)
        TagLog.objects.filter(pk=log1.pk).update(timestamp=now - timedelta(days=35))
        
        # Log 2: 25 days old (should be kept)
        log2 = TagLog.objects.create(tag=tag_default, value=26.0)
        TagLog.objects.filter(pk=log2.pk).update(timestamp=now - timedelta(days=25))
        
        # 3. Create TagLogs for tag_short (retention = 10 days)
        # Log 3: 15 days old (should be purged)
        log3 = TagLog.objects.create(tag=tag_short, value=1.0)
        TagLog.objects.filter(pk=log3.pk).update(timestamp=now - timedelta(days=15))
        
        # Log 4: 5 days old (should be kept)
        log4 = TagLog.objects.create(tag=tag_short, value=2.0)
        TagLog.objects.filter(pk=log4.pk).update(timestamp=now - timedelta(days=5))
        
        # 5. Create TagLogs for tag_long (retention = 60 days)
        # Log 5: 45 days old (should be kept)
        log5 = TagLog.objects.create(tag=tag_long, value=100.0)
        TagLog.objects.filter(pk=log5.pk).update(timestamp=now - timedelta(days=45))
        
        # Verify pre-purge state
        self.assertEqual(TagLog.objects.count(), 5)
        
        # 6. Run purge
        purged_count = purge_old_taglogs()
        
        # We expect 2 logs to be purged (log1 and log3)
        self.assertEqual(purged_count, 2)
        
        # 7. Verify post-purge state
        remaining_ids = set(TagLog.objects.values_list('id', flat=True))
        self.assertNotIn(log1.id, remaining_ids)
        self.assertIn(log2.id, remaining_ids)
        self.assertNotIn(log3.id, remaining_ids)
        self.assertIn(log4.id, remaining_ids)
        self.assertIn(log5.id, remaining_ids)

    def test_alarm_event_foreign_key_preservation(self):
        # Verify that deleting a TagLog sets the FK on AlarmEvent to NULL but does not delete AlarmEvent
        tag = Tag.objects.create(name="TagAlarmTest", data_type="float")
        log = TagLog.objects.create(tag=tag, value=99.9)
        
        # Create an AlarmRule and AlarmEvent
        rule = AlarmRule.objects.create(tag=tag, name="High Temp", severity="high")
        event = AlarmEvent.objects.create(
            rule=rule,
            tag_log=log,
            level="alarm",
            state="active",
            triggered_value=99.9,
            message="Temperature too high"
        )
        
        # Make the log old to trigger purge (retention = 1 day for this test)
        TagLog.objects.filter(pk=log.pk).update(timestamp=timezone.now() - timedelta(days=5))
        tag.retention_days = 1
        tag.save()
        
        # Verify initial state
        self.assertEqual(AlarmEvent.objects.filter(tag_log=log).count(), 1)
        
        # Run purge
        purge_old_taglogs()
        
        # Verify log is gone
        self.assertFalse(TagLog.objects.filter(pk=log.pk).exists())
        
        # Verify AlarmEvent still exists but its tag_log FK is NULL
        event.refresh_from_db()
        self.assertIsNone(event.tag_log)
        self.assertEqual(event.triggered_value, 99.9)


from rest_framework.test import APITestCase

class AIEnergyAdvisoryTestCase(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_superuser(username='admin', email='admin@kora.com', password='password')
        self.client.force_authenticate(user=self.user)
        
        # Create flow, pressure, pump tags
        self.flow_tag = Tag.objects.create(name='Flow_Rate', data_type='float')
        self.press_tag = Tag.objects.create(name='System_Pressure', data_type='float')
        self.pump_tag = Tag.objects.create(name='Pump_Status', data_type='float')
        
        # Create some TagLogs
        TagLog.objects.create(tag=self.flow_tag, value=230.0)
        TagLog.objects.create(tag=self.press_tag, value=3.5)
        TagLog.objects.create(tag=self.pump_tag, value=1.0)

    def test_energy_advisory_endpoint(self):
        url = reverse('ai_energy_advisory')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['type'], 'energy_advisory')
        self.assertEqual(data['source'], 'energy_optimizer')
        self.assertIn('metrics', data)
        self.assertIn('recommendations', data)


