import time
import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from core.models import Tag, TagLog

logger = logging.getLogger(__name__)

def purge_old_taglogs(chunk_size=1000, sleep_seconds=0.05, dry_run=False):
    """
    Purges historical TagLog records exceeding their configured retention period.
    Deletes records in small batches/chunks to avoid table locks or high CPU usage.
    
    :param chunk_size: Number of records to delete in a single batch.
    :param sleep_seconds: Wait time (in seconds) between batches to yield database locks.
    :param dry_run: If True, calculates and logs what would be deleted without executing SQL.
    """
    logger.info(f"Starting TagLog purge job. Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    
    # 1. Fetch default retention setting
    global_retention_days = getattr(settings, 'TAGLOG_RETENTION_DAYS', 30)
    now = timezone.now()
    
    total_purged = 0
    
    # 2. Purge tag logs on a per-tag basis (custom retention + default fallback)
    tags = Tag.objects.all()
    for tag in tags:
        retention_days = tag.retention_days if tag.retention_days is not None else global_retention_days
        cutoff = now - timedelta(days=retention_days)
        
        # Get query for expired logs for this tag
        expired_qs = TagLog.objects.filter(tag=tag, timestamp__lt=cutoff)
        
        if dry_run:
            count = expired_qs.count()
            if count > 0:
                logger.info(f"[DRY RUN] Would delete {count} log(s) for tag '{tag.name}' (older than {cutoff.isoformat()}, retention: {retention_days} days)")
                total_purged += count
            continue
            
        # Live run: Delete in chunks
        tag_purged = 0
        while True:
            # Select IDs of a chunk of expired logs to delete.
            # Using primary keys avoids complex locks on table scans.
            pks = list(expired_qs.values_list('id', flat=True)[:chunk_size])
            if not pks:
                break
                
            with transaction.atomic():
                deleted_count, _ = TagLog.objects.filter(id__in=pks).delete()
                tag_purged += deleted_count
                total_purged += deleted_count
                
            if len(pks) < chunk_size:
                # Last batch completed
                break
                
            # Yield database lock and CPU execution
            time.sleep(sleep_seconds)
            
        if tag_purged > 0:
            logger.info(f"Purged {tag_purged} log(s) for tag '{tag.name}' (retention: {retention_days} days)")

    # 3. Clean up any orphaned logs (e.g. logs without a valid tag) older than global default
    orphaned_cutoff = now - timedelta(days=global_retention_days)
    orphaned_qs = TagLog.objects.filter(tag__isnull=True, timestamp__lt=orphaned_cutoff)
    
    if dry_run:
        count = orphaned_qs.count()
        if count > 0:
            logger.info(f"[DRY RUN] Would delete {count} orphaned log(s) (older than {orphaned_cutoff.isoformat()})")
            total_purged += count
    else:
        orphaned_purged = 0
        while True:
            pks = list(orphaned_qs.values_list('id', flat=True)[:chunk_size])
            if not pks:
                break
                
            with transaction.atomic():
                deleted_count, _ = TagLog.objects.filter(id__in=pks).delete()
                orphaned_purged += deleted_count
                total_purged += deleted_count
                
            if len(pks) < chunk_size:
                break
                
            time.sleep(sleep_seconds)
            
        if orphaned_purged > 0:
            logger.info(f"Purged {orphaned_purged} orphaned tag log(s)")
            
    logger.info(f"TagLog purge job completed. Total records processed/purged: {total_purged}")
    return total_purged
