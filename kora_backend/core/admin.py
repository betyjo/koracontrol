from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin
from unfold.forms import UserChangeForm, UserCreationForm
from .models import User, Tag, TagLog, Bill, PaymentTransaction, Complaint, AIAnalysis

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

@admin.register(Bill)
class BillAdmin(ModelAdmin):
    list_display = ("user", "amount", "usage_kwh", "is_paid", "billing_date")
    list_filter = ("is_paid", "billing_date")
    search_fields = ("user__username",)

@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(ModelAdmin):
    list_display = ("tx_ref", "user", "amount", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("tx_ref", "user__username")

@admin.register(Complaint)
class ComplaintAdmin(ModelAdmin):
    list_display = ("subject", "user", "status", "priority", "created_at")
    list_filter = ("status", "priority", "created_at")
    search_fields = ("subject", "user__username")

@admin.register(AIAnalysis)
class AIAnalysisAdmin(ModelAdmin):
    list_display = ("tag", "is_anomaly", "confidence_score", "detected_at")
    list_filter = ("is_anomaly", "detected_at")
