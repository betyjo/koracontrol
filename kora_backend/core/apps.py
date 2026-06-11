from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        from . import signals  # noqa: F401
        
        import os
        import sys
        
        # Only start scheduler in the main process (skip migrations/tests/reloader threads)
        is_server = 'runserver' in sys.argv or 'gunicorn' in sys.argv[0] or 'uvicorn' in sys.argv[0]
        is_main_thread = os.environ.get('RUN_MAIN', None) == 'true'
        
        if is_server and is_main_thread:
            try:
                from apscheduler.schedulers.background import BackgroundScheduler
                from django_apscheduler.jobstores import DjangoJobStore
                from .billing_job import generate_monthly_bills
                from .jobs import purge_old_taglogs
                
                scheduler = BackgroundScheduler()
                scheduler.add_jobstore(DjangoJobStore(), "default")
                
                scheduler.add_job(
                    generate_monthly_bills,
                    'cron',
                    hour=1,
                    minute=0,
                    id='generate_monthly_bills_cron',
                    replace_existing=True,
                )
                
                scheduler.add_job(
                    purge_old_taglogs,
                    'cron',
                    hour=2,
                    minute=0,
                    id='purge_old_taglogs_cron',
                    replace_existing=True,
                )
                
                scheduler.start()
                import logging
                logger = logging.getLogger(__name__)
                logger.info("APScheduler started successfully for automatic billing generation.")
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to start APScheduler: {e}")
