import time
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from core.models import TagLog, AIAnalysis, AlarmEvent

class Command(BaseCommand):
    help = "Safely prunes old historical TagLog, AIAnalysis, and closed AlarmEvent records in batches."

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=3,
            help='Prune records older than this number of days (default: 3)'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=500,
            help='Number of records to delete in a single batch (default: 500)'
        )
        parser.add_argument(
            '--sleep',
            type=float,
            default=0.1,
            help='Wait time in seconds between batches to avoid lock contention (default: 0.1)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Calculate and report what would be deleted without making database changes'
        )

    def handle(self, *args, **options):
        days = options['days']
        batch_size = options['batch_size']
        sleep_seconds = options['sleep']
        dry_run = options['dry_run']

        now = timezone.now()
        cutoff = now - timedelta(days=days)

        self.stdout.write(self.style.WARNING(f"Starting database cleanup (Mode: {'DRY RUN' if dry_run else 'LIVE'})..."))
        self.stdout.write(self.style.WARNING(f"Pruning records older than {days} days (cutoff: {cutoff.isoformat()})"))

        # Define non-active state choices for AlarmEvents
        # We preserve active alarms so they are not lost.
        closed_alarm_states = ['returned', 'acknowledged', 'shelved', 'suppressed']

        # Prepare queries
        taglog_qs = TagLog.objects.filter(timestamp__lt=cutoff)
        aianalysis_qs = AIAnalysis.objects.filter(detected_at__lt=cutoff)
        alarmevent_qs = AlarmEvent.objects.filter(state__in=closed_alarm_states, triggered_at__lt=cutoff)

        # 1. Purge TagLog
        self.purge_model_records(
            model_name="TagLog",
            queryset=taglog_qs,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
            dry_run=dry_run
        )

        # 2. Purge AIAnalysis
        self.purge_model_records(
            model_name="AIAnalysis",
            queryset=aianalysis_qs,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
            dry_run=dry_run
        )

        # 3. Purge AlarmEvent
        self.purge_model_records(
            model_name="AlarmEvent",
            queryset=alarmevent_qs,
            batch_size=batch_size,
            sleep_seconds=sleep_seconds,
            dry_run=dry_run
        )

        self.stdout.write(self.style.SUCCESS("Database cleanup completed successfully!"))

    def purge_model_records(self, model_name, queryset, batch_size, sleep_seconds, dry_run):
        total_count = queryset.count()
        if total_count == 0:
            self.stdout.write(self.style.SUCCESS(f"No expired {model_name} records found to delete."))
            return

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"[DRY RUN] Would delete {total_count} expired {model_name} records."))
            return

        self.stdout.write(self.style.WARNING(f"Purging {total_count} expired {model_name} records in batches of {batch_size}..."))
        
        deleted_total = 0
        while True:
            # Fetch IDs of the next batch.
            # Using primary keys avoids complex table locks on delete operations.
            pks = list(queryset.values_list('id', flat=True)[:batch_size])
            if not pks:
                break

            with transaction.atomic():
                # Delete by PK list
                deleted_count, _ = queryset.model.objects.filter(id__in=pks).delete()
                deleted_total += deleted_count

            self.stdout.write(f"  Deleted {deleted_total}/{total_count} {model_name} records...")

            if len(pks) < batch_size:
                break

            # Sleep to prevent CPU spikes and allow concurrent database queries
            time.sleep(sleep_seconds)

        self.stdout.write(self.style.SUCCESS(f"Successfully purged {deleted_total} {model_name} records."))
