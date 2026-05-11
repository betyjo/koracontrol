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
        ("Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    tab_overview = (
        (None, {"fields": ("username", "role", "phone_number", "email")}),
    )

    tab_permissions = (
        (None, {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )

    tabs = [
        ("Overview", "tab_overview"),
        ("Permissions", "tab_permissions"),
    ]

@admin.register(Tag)
class TagAdmin(ModelAdmin):
    list_display = ("name", "data_type", "unit")
    search_fields = ("name",)

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
