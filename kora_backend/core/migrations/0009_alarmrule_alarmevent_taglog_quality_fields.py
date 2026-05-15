from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_dashboard_visualization"),
    ]

    operations = [
        migrations.AddField(
            model_name="taglog",
            name="quality_code",
            field=models.CharField(default="good", max_length=12),
        ),
        migrations.AddField(
            model_name="taglog",
            name="source_timestamp",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="AlarmRule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("is_enabled", models.BooleanField(default=True)),
                (
                    "severity",
                    models.CharField(
                        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High"), ("critical", "Critical")],
                        default="medium",
                        max_length=10,
                    ),
                ),
                ("warning_high", models.FloatField(blank=True, null=True)),
                ("alarm_high", models.FloatField(blank=True, null=True)),
                ("warning_low", models.FloatField(blank=True, null=True)),
                ("alarm_low", models.FloatField(blank=True, null=True)),
                ("deadband", models.FloatField(default=0.0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("tag", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="alarm_rules", to="core.tag")),
            ],
            options={"ordering": ["tag__name", "name", "id"]},
        ),
        migrations.CreateModel(
            name="AlarmEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("level", models.CharField(choices=[("warning", "Warning"), ("alarm", "Alarm")], max_length=8)),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("active", "Active"),
                            ("acknowledged", "Acknowledged"),
                            ("returned", "Returned to normal"),
                            ("shelved", "Shelved"),
                            ("suppressed", "Suppressed"),
                        ],
                        default="active",
                        max_length=16,
                    ),
                ),
                ("triggered_value", models.FloatField()),
                ("message", models.CharField(blank=True, max_length=255)),
                ("triggered_at", models.DateTimeField(auto_now_add=True)),
                ("returned_to_normal_at", models.DateTimeField(blank=True, null=True)),
                ("acknowledged_at", models.DateTimeField(blank=True, null=True)),
                ("ack_note", models.CharField(blank=True, max_length=255)),
                ("shelved_until", models.DateTimeField(blank=True, null=True)),
                ("shelve_note", models.CharField(blank=True, max_length=255)),
                (
                    "acknowledged_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="acknowledged_alarm_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                ("rule", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="events", to="core.alarmrule")),
                (
                    "shelved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="shelved_alarm_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "tag_log",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="alarm_events",
                        to="core.taglog",
                    ),
                ),
            ],
            options={"ordering": ["-triggered_at"]},
        ),
        migrations.AlterUniqueTogether(
            name="alarmrule",
            unique_together={("tag", "name")},
        ),
    ]
