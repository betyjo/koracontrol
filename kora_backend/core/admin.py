from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.forms import UserChangeForm, UserCreationForm
from . import frontend_links
from .models import (
    User,
    Tag,
    TagLog,
    Bill,
    PaymentTransaction,
    Complaint,
    AIAnalysis,
    DashboardVisualization,
    AlarmRule,
    AlarmEvent,
    PlantArea,
    PlantEquipment,
    TrendAnnotation,
    OperatorJournalEntry,
    InAppNotification,
    NotificationSubscription,
    MaintenanceTask,
    ProcessSetpoint,
    WaterQualityMetric,
    EquipmentHealth,
)

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = UserChangeForm
    list_display = ("username", "email", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "email", "phone_number")}),
        ("Biometrics", {"fields": ("profile_photo", "face_encoding")}),
        ("Billing info", {"fields": ("meter_tag", "billing_rate")}),
        ("Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "password1", "password2"),
        }),
        ("Role Assignment", {
            "classes": ("wide",),
            "fields": ("role",),
            "description": "ADMIN = Web Admin Panel only  |  OPERATOR = Desktop HMI only  |  CUSTOMER = Frontend portal only",
        }),
        ("Personal info", {
            "classes": ("wide",),
            "fields": ("first_name", "last_name", "email", "phone_number"),
        }),
        ("Biometrics", {
            "classes": ("wide",),
            "fields": ("profile_photo",),
            "description": "Upload a clear face photo to enable Face ID Login for this user.",
        }),
    )

    tab_overview = (
        (None, {"fields": ("username", "role", "phone_number", "email", "meter_tag", "billing_rate", "profile_photo")}),
    )

    tab_permissions = (
        (None, {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )

    tabs = [
        ("Overview", "tab_overview"),
        ("Permissions", "tab_permissions"),
    ]

    actions = ["generate_bills_action"]

    @admin.action(description="Generate bills for selected customers now")
    def generate_bills_action(self, request, queryset):
        from .billing_job import generate_monthly_bills
        from .models import Bill, TagLog
        from django.utils import timezone
        from datetime import timedelta
        from decimal import Decimal
        
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        bills_created = 0

        customers = queryset.filter(role='customer', meter_tag__isnull=False)
        for customer in customers:
            if Bill.objects.filter(user=customer, billing_date__month=now.month, billing_date__year=now.year).exists():
                continue
                
            latest_log = TagLog.objects.filter(tag=customer.meter_tag).order_by('-timestamp').first()
            old_log = TagLog.objects.filter(tag=customer.meter_tag, timestamp__lte=thirty_days_ago).order_by('-timestamp').first()
            if not old_log:
                old_log = TagLog.objects.filter(tag=customer.meter_tag).order_by('timestamp').first()
                
            if not latest_log or not old_log or latest_log == old_log:
                continue
                
            usage = max(0, latest_log.value - old_log.value)
            amount = Decimal(usage) * customer.billing_rate
            
            if amount > 0:
                Bill.objects.create(user=customer, amount=amount, usage_kwh=usage)
                bills_created += 1

        self.message_user(request, f"Successfully generated {bills_created} bills.")

@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ("name", "data_type", "unit", "retention_days")
    search_fields = ("name",)
    fields = ("name", "data_type", "unit", "description", "retention_days")

@admin.register(TagLog)
class TagLogAdmin(ModelAdmin):
    list_display = ("tag", "value", "timestamp")
    list_filter = ("tag", "timestamp")
    ordering = ("-timestamp",)


@admin.register(DashboardVisualization)
class DashboardVisualizationAdmin(ModelAdmin):
    list_display = (
        "visual_title",
        "tag",
        "widget_type",
        "sort_order",
        "is_active",
        "scale_range",
        "thresholds_preview",
    )
    list_editable = ("sort_order", "is_active")
    list_filter = ("widget_type", "is_active", "tag")
    search_fields = ("title", "tag__name")
    ordering = ("sort_order", "id")
    autocomplete_fields = ("tag",)

    fieldsets = (
        (
            "Customer dashboard widget",
            {
                "fields": ("tag", "widget_type", "title", "sort_order", "is_active"),
                "description": "Controls what appears on the Next.js Monitoring page for all logged-in portal users.",
            },
        ),
        (
            "Scale (tank fill & gauge sweep)",
            {
                "fields": ("scale_min", "scale_max"),
                "description": "Raw sensor values map linearly onto 0–100% fill / needle sweep.",
            },
        ),
        (
            "Alarm & warning thresholds",
            {
                "fields": ("alarm_high", "alarm_low", "warning_high", "warning_low"),
                "description": (
                    "Optional. Alarm overrides warning. Neon status lamp and highlights use derived level: "
                    "normal · warning · alarm."
                ),
            },
        ),
    )

    @admin.display(description="Title")
    def visual_title(self, obj):
        return obj.title.strip() if obj.title else obj.tag.name

    @admin.display(description="Scale")
    def scale_range(self, obj):
        return format_html("{} → {}", obj.scale_min, obj.scale_max)

    @admin.display(description="Thresholds")
    def thresholds_preview(self, obj):
        parts = []
        if obj.alarm_low is not None or obj.alarm_high is not None:
            parts.append(f"alarm [{obj.alarm_low}, {obj.alarm_high}]")
        if obj.warning_low is not None or obj.warning_high is not None:
            parts.append(f"warn [{obj.warning_low}, {obj.warning_high}]")
        return ", ".join(parts) if parts else "—"


@admin.register(Bill)
class BillAdmin(ModelAdmin):
    list_display = ("user", "amount", "usage_kwh", "is_paid", "billing_date", "portal_link_column")
    list_filter = ("is_paid", "billing_date")
    search_fields = ("user__username",)

    @admin.display(description="Portal")
    def portal_link_column(self, obj):
        url = frontend_links.billing_url(bill_id=obj.pk)
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Open in portal</a>',
            url,
        )

    def view_on_site(self, obj):
        return frontend_links.billing_url(bill_id=obj.pk)

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(ModelAdmin):
    list_display = ("tx_ref", "user", "amount", "status", "created_at", "portal_link_column")
    list_filter = ("status", "created_at")
    search_fields = ("tx_ref", "user__username")

    @admin.display(description="Portal")
    def portal_link_column(self, obj):
        url = frontend_links.billing_url(bill_id=obj.bill_id, tx_ref=obj.tx_ref)
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Billing & receipt</a>',
            url,
        )

    def view_on_site(self, obj):
        return frontend_links.billing_url(bill_id=obj.bill_id, tx_ref=obj.tx_ref)

@admin.register(Complaint)
class ComplaintAdmin(ModelAdmin):
    list_display = ("subject", "user", "status", "priority", "created_at", "portal_link_column")
    list_filter = ("status", "priority", "created_at")
    search_fields = ("subject", "user__username")

    @admin.display(description="Portal")
    def portal_link_column(self, obj):
        url = frontend_links.complaints_url(complaint_id=obj.pk)
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Open in portal</a>',
            url,
        )

    def view_on_site(self, obj):
        return frontend_links.complaints_url(complaint_id=obj.pk)

@admin.register(AIAnalysis)
class AIAnalysisAdmin(ModelAdmin):
    list_display = ("tag", "is_anomaly", "confidence_score", "detected_at", "portal_link_column")
    list_filter = ("is_anomaly", "detected_at")

    @admin.display(description="Portal")
    def portal_link_column(self, obj):
        url = frontend_links.analytics_url(analysis_id=obj.pk)
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Open in portal</a>',
            url,
        )

    def view_on_site(self, obj):
        return frontend_links.analytics_url(analysis_id=obj.pk)


@admin.register(AlarmRule)
class AlarmRuleAdmin(ModelAdmin):
    list_display = ("name", "tag", "severity", "is_enabled", "updated_at")
    list_filter = ("severity", "is_enabled", "tag")
    search_fields = ("name", "tag__name")


@admin.register(AlarmEvent)
class AlarmEventAdmin(ModelAdmin):
    list_display = ("rule", "level", "state", "triggered_value", "triggered_at", "acknowledged_by")
    list_filter = ("state", "level", "rule__severity", "triggered_at")
    search_fields = ("rule__name", "rule__tag__name", "message")


@admin.register(PlantArea)
class PlantAreaAdmin(ModelAdmin):
    list_display = ("code", "name", "sort_order")
    search_fields = ("code", "name")


@admin.register(PlantEquipment)
class PlantEquipmentAdmin(ModelAdmin):
    list_display = ("code", "name", "area", "primary_tag")
    list_filter = ("area",)
    search_fields = ("code", "name")


@admin.register(MaintenanceTask)
class MaintenanceTaskAdmin(ModelAdmin):
    list_display = (
        "title",
        "asset",
        "status",
        "priority",
        "created_by",
        "assigned_to",
        "planned_start",
        "planned_end",
    )
    list_filter = ("status", "priority", "asset__area")
    search_fields = ("title", "description", "asset__name")
    autocomplete_fields = ("asset", "created_by", "assigned_to")


@admin.register(ProcessSetpoint)
class ProcessSetpointAdmin(ModelAdmin):
    list_display = ("tag", "target_value", "mode", "effective_from", "effective_until")
    list_filter = ("mode", "tag")
    search_fields = ("tag__name", "description")
    autocomplete_fields = ("tag",)


@admin.register(WaterQualityMetric)
class WaterQualityMetricAdmin(ModelAdmin):
    list_display = ("metric_name", "area", "tag", "current_value", "status", "last_updated")
    list_filter = ("status", "area")
    search_fields = ("metric_name", "tag__name")
    autocomplete_fields = ("area", "tag")


@admin.register(EquipmentHealth)
class EquipmentHealthAdmin(ModelAdmin):
    list_display = ("equipment", "health_score", "last_inspection_at", "next_due_at")
    list_filter = ("equipment__area",)
    search_fields = ("equipment__name", "recommended_action")
    autocomplete_fields = ("equipment",)


@admin.register(TrendAnnotation)
class TrendAnnotationAdmin(ModelAdmin):
    list_display = ("label", "tag", "at", "created_by")
    list_filter = ("tag",)
    search_fields = ("label", "notes")


@admin.register(OperatorJournalEntry)
class OperatorJournalEntryAdmin(ModelAdmin):
    list_display = ("title", "author", "occurred_at", "related_alarm_event")
    search_fields = ("title", "body")


@admin.register(InAppNotification)
class InAppNotificationAdmin(ModelAdmin):
    list_display = ("user", "category", "title", "read_at", "created_at")
    list_filter = ("category", "read_at")


@admin.register(NotificationSubscription)
class NotificationSubscriptionAdmin(ModelAdmin):
    list_display = ("user", "channel", "destination", "notify_alarm_critical", "notify_complaint_sla", "is_active")
    list_filter = ("channel", "is_active")
