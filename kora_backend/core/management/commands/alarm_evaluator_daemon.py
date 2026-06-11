from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import time
import signal
import sys

from core.models import Tag, TagLog, AlarmRule
from core.alarm_evaluator import evaluate_alarm_for_log


class Command(BaseCommand):
    help = 'Run alarm evaluation daemon - periodically evaluates alarms (for development/testing)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=10,
            help='Evaluation interval in seconds (default: 10)',
        )
        parser.add_argument(
            '--once',
            action='store_true',
            help='Run evaluation once and exit',
        )

    def handle(self, *args, **options):
        interval = options.get('interval', 10)
        run_once = options.get('once', False)
        
        self.stdout.write(f"🚀 Alarm Evaluator Daemon starting...")
        self.stdout.write(f"⏱️  Evaluation interval: {interval} seconds")
        
        # Set up signal handlers for graceful shutdown
        self.running = True
        
        def signal_handler(signum, frame):
            self.stdout.write(f"\n🛑 Received signal {signum}, shutting down...")
            self.running = False
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        evaluation_count = 0
        
        try:
            while self.running:
                evaluation_count += 1
                self.stdout.write(f"\n{'='*50}")
                self.stdout.write(f"🔄 Evaluation cycle #{evaluation_count}")
                self.stdout.write(f"{'='*50}")
                
                self.evaluate_all_alarms()
                
                if run_once:
                    self.stdout.write("✅ Single evaluation completed")
                    break
                
                self.stdout.write(f"⏳ Next evaluation in {interval} seconds...")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            self.stdout.write("\n🛑 Interrupted by user")
        except Exception as e:
            self.stdout.write(f"❌ Error in alarm evaluator daemon: {e}")
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Alarm evaluator daemon error")
        finally:
            self.stdout.write(f"🏁 Alarm Evaluator Daemon stopped (total evaluations: {evaluation_count})")

    def evaluate_all_alarms(self):
        """Evaluate all enabled alarm rules against current tag values"""
        
        # Get all enabled alarm rules
        alarm_rules = AlarmRule.objects.filter(is_enabled=True)
        if alarm_rules.count() == 0:
            self.stdout.write("⚠️  No enabled alarm rules found")
            return
        
        self.stdout.write(f"⚙️  Found {alarm_rules.count()} enabled alarm rules")
        
        # Get unique tags that have alarm rules
        tags_with_rules = Tag.objects.filter(
            id__in=alarm_rules.values_list('tag_id', flat=True)
        ).distinct()
        
        time_threshold = timezone.now() - timedelta(minutes=5)
        events_created = 0
        tags_evaluated = 0
        
        for tag in tags_with_rules:
            try:
                # Get latest tag log for this tag
                latest_log = TagLog.objects.filter(
                    tag=tag,
                    timestamp__gte=time_threshold
                ).order_by('-timestamp').first()
                
                if not latest_log:
                    self.stdout.write(f"⏭️  No recent logs for tag: {tag.name}")
                    continue
                
                tags_evaluated += 1
                
                # Evaluate the alarm
                evaluate_alarm_for_log(latest_log)
                
                self.stdout.write(f"✅ Evaluated tag: {tag.name} = {latest_log.value}")
                
            except Exception as e:
                self.stdout.write(f"❌ Error evaluating tag {tag.name}: {e}")
                import logging
                logger = logging.getLogger(__name__)
                logger.exception(f"Error evaluating alarms for tag {tag.name}")
        
        self.stdout.write(f"\n📊 Evaluated {tags_evaluated} tags with alarm rules")
