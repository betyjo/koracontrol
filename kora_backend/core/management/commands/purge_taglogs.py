from django.core.management.base import BaseCommand
from core.jobs import purge_old_taglogs

class Command(BaseCommand):
    help = "Purges expired TagLog entries safely without busying the database."

    def add_arguments(self, parser):
        parser.add_argument(
            '--chunk-size',
            type=int,
            default=1000,
            help='Number of logs to delete in a single batch (default: 1000)'
        )
        parser.add_argument(
            '--sleep-seconds',
            type=float,
            default=0.05,
            help='Wait time in seconds between batches to avoid lock contention (default: 0.05)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Calculate and report what would be deleted without making database changes'
        )

    def handle(self, *args, **options):
        chunk_size = options['chunk_size']
        sleep_seconds = options['sleep_seconds']
        dry_run = options['dry_run']
        
        self.stdout.write(self.style.WARNING("Starting TagLog purge process..."))
        
        try:
            total_deleted = purge_old_taglogs(
                chunk_size=chunk_size,
                sleep_seconds=sleep_seconds,
                dry_run=dry_run
            )
            
            if dry_run:
                self.stdout.write(self.style.SUCCESS(
                    f"Dry run complete. Would have deleted {total_deleted} expired TagLog entries."
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"Purge complete. Successfully deleted {total_deleted} expired TagLog entries."
                ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error during purge: {e}"))
            raise e
