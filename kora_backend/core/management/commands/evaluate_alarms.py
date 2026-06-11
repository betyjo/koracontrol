from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import Tag, TagLog, AlarmRule
from core.alarm_evaluator import evaluate_alarm_for_log


class Command(BaseCommand):
    help = 'Evaluate alarm rules against current tag values and create/update alarm events'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tag-id',
            type=int,
            help='Evaluate alarms for a specific tag ID only',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually creating alarm events',
        )
        parser.add_argument(
            '--minutes',
            type=int,
            default=5,
            help='Minutes to look back for latest tag values (default: 5)',
        )

    def handle(self, *args, **options):
        tag_id = options.get('tag_id')
        dry_run = options.get('dry_run', False)
        minutes = options.get('minutes', 5)
        
        self.stdout.write(f"🚀 Starting alarm evaluation...")
        if dry_run:
            self.stdout.write("🧪 DRY RUN MODE - No alarm events will be created")
        
        # Get tags to evaluate
        if tag_id:
            try:
                tags = [Tag.objects.get(id=tag_id)]
                self.stdout.write(f"📌 Evaluating alarms for tag ID: {tag_id}")
            except Tag.DoesNotExist:
                self.stdout.write(f"❌ Tag with ID {tag_id} not found")
                return
        else:
            tags = Tag.objects.all()
            self.stdout.write(f"📊 Evaluating alarms for all {tags.count()} tags")
        
        # Get enabled alarm rules
        alarm_rules = AlarmRule.objects.filter(is_enabled=True)
        if alarm_rules.count() == 0:
            self.stdout.write("⚠️  No enabled alarm rules found")
            return
        
        self.stdout.write(f"⚙️  Found {alarm_rules.count()} enabled alarm rules")
        
        # Calculate time threshold
        time_threshold = timezone.now() - timedelta(minutes=minutes)
        
        events_created = 0
        events_updated = 0
        tags_processed = 0
        
        for tag in tags:
            try:
                # Get latest tag log for this tag
                latest_log = TagLog.objects.filter(
                    tag=tag,
                    timestamp__gte=time_threshold
                ).order_by('-timestamp').first()
                
                if not latest_log:
                    self.stdout.write(f"⏭️  No recent logs for tag: {tag.name}")
                    continue
                
                tags_processed += 1
                
                if dry_run:
                    # Show what would happen without actually doing it
                    self.stdout.write(f"🔍 Would evaluate tag: {tag.name} = {latest_log.value}")
                    
                    # Check if there are any enabled rules for this tag
                    tag_rules = alarm_rules.filter(tag=tag)
                    if tag_rules.exists():
                        self.stdout.write(f"   📋 {tag_rules.count()} alarm rules for this tag")
                        for rule in tag_rules:
                            self.stdout.write(f"   - {rule.name} ({rule.severity})")
                    continue
                
                # Actually evaluate the alarm
                old_event_count = AlarmRule.objects.filter(tag=tag).count()
                evaluate_alarm_for_log(latest_log)
                
                # Check if new events were created (simple check)
                # This is not perfect but gives an indication
                new_event_count = AlarmRule.objects.filter(tag=tag).count()
                
                if new_event_count > old_event_count:
                    events_created += (new_event_count - old_event_count)
                    self.stdout.write(f"✅ Created alarm events for tag: {tag.name}")
                else:
                    events_updated += 1
                    self.stdout.write(f"🔄 Evaluated tag: {tag.name} = {latest_log.value}")
                
            except Exception as e:
                self.stdout.write(f"❌ Error evaluating tag {tag.name}: {e}")
                import logging
                logger = logging.getLogger(__name__)
                logger.exception(f"Error evaluating alarms for tag {tag.name}")
        
        # Summary
        self.stdout.write(f"\n{'='*50}")
        self.stdout.write(f"📊 EVALUATION SUMMARY")
        self.stdout.write(f"{'='*50}")
        self.stdout.write(f"Tags processed: {tags_processed}")
        self.stdout.write(f"Alarm rules enabled: {alarm_rules.count()}")
        if not dry_run:
            self.stdout.write(f"Events created: {events_created}")
            self.stdout.write(f"Events updated: {events_updated}")
        else:
            self.stdout.write(f"DRY RUN - No changes made")
        self.stdout.write(f"{'='*50}")
        
        if not dry_run:
            self.stdout.write("✅ Alarm evaluation completed successfully")
        else:
            self.stdout.write("✅ Dry run completed successfully")
