from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    # Define roles as per the blueprint
    ADMIN = 'admin'
    OPERATOR = 'operator'
    CUSTOMER = 'customer'
    
    ROLE_CHOICES = [
        (ADMIN, 'Admin'),
        (OPERATOR, 'SCADA Operator'),
        (CUSTOMER, 'Web Customer'),
    ]
    
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=CUSTOMER)
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.role})"

    def save(self, *args, **kwargs):
        # Ensure superusers always have the admin role
        if self.is_superuser and self.role != self.ADMIN:
            self.role = self.ADMIN
        # Ensure staff always have at least operator role if they are not admin
        elif self.is_staff and self.role == self.CUSTOMER:
            self.role = self.OPERATOR
        super().save(*args, **kwargs)

class Tag(models.Model):
    name = models.CharField(max_length=100, unique=True) # e.g., "Boiler_Temp"
    data_type = models.CharField(max_length=20, default="float")
    unit = models.CharField(max_length=10, blank=True) # e.g., "°C"
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class TagLog(models.Model):
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='logs')
    value = models.FloatField()
    quality_code = models.CharField(max_length=12, default='good')  # good | bad | uncertain
    source_timestamp = models.DateTimeField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp'] # Latest data first


class DashboardVisualization(models.Model):
    """
    Admin-controlled SCADA widgets on the Next.js Monitoring dashboard.
    Each row maps a Tag to one visual representation.
    """

    WIDGET_TYPES = (
        ('tank', 'Animated tank'),
        ('gauge', 'Circular gauge'),
        ('status', 'Neon status'),
        ('trend', '60s trend chart'),
    )

    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='dashboard_widgets')
    widget_type = models.CharField(max_length=16, choices=WIDGET_TYPES)
    title = models.CharField(max_length=120, blank=True, help_text='Leave blank to use tag name.')
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    scale_min = models.FloatField(default=0)
    scale_max = models.FloatField(default=100, help_text='Used for gauge/tank filling and thresholds context.')

    warning_high = models.FloatField(null=True, blank=True)
    alarm_high = models.FloatField(null=True, blank=True)
    warning_low = models.FloatField(null=True, blank=True)
    alarm_low = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ('sort_order', 'id')

    def __str__(self):
        label = self.title or self.tag.name
        return f'{label} ({self.get_widget_type_display()})'


import uuid

class Bill(models.Model):
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='bills')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    usage_kwh = models.FloatField(help_text="Units consumed from SCADA data")
    is_paid = models.BooleanField(default=False)
    billing_date = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"Bill {self.id} - {self.user.username} - {'Paid' if self.is_paid else 'Pending'}"

class PaymentTransaction(models.Model):
    user = models.ForeignKey('core.User', on_delete=models.CASCADE)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE)
    # tx_ref is required by Chapa to track the specific transaction
    tx_ref = models.CharField(max_length=100, unique=True, default=uuid.uuid4)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, default='pending') # pending, success, failed
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Tx {self.tx_ref} - {self.status}"

class Complaint(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('investigating', 'Investigating'),
        ('resolved', 'Resolved'),
    ]
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='complaints')
    subject = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    first_response_at = models.DateTimeField(null=True, blank=True)
    sla_notification_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.subject} - {self.user.username} ({self.status})"

class AIAnalysis(models.Model):
    tag = models.ForeignKey('core.Tag', on_delete=models.CASCADE)
    is_anomaly = models.BooleanField(default=False)
    confidence_score = models.FloatField() # e.g., 0.98 for 98% certain
    explanation = models.TextField() # e.g., "Sudden spike in pressure detected"
    detected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analysis for {self.tag.name} - Anomaly: {self.is_anomaly}"


class AlarmRule(models.Model):
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    tag = models.ForeignKey('core.Tag', on_delete=models.CASCADE, related_name='alarm_rules')
    name = models.CharField(max_length=120)
    is_enabled = models.BooleanField(default=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='medium')
    warning_high = models.FloatField(null=True, blank=True)
    alarm_high = models.FloatField(null=True, blank=True)
    warning_low = models.FloatField(null=True, blank=True)
    alarm_low = models.FloatField(null=True, blank=True)
    deadband = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tag__name', 'name', 'id']
        unique_together = [('tag', 'name')]

    def __str__(self):
        return f"{self.tag.name} :: {self.name}"


class AlarmEvent(models.Model):
    STATE_CHOICES = [
        ('active', 'Active'),
        ('acknowledged', 'Acknowledged'),
        ('returned', 'Returned to normal'),
        ('shelved', 'Shelved'),
        ('suppressed', 'Suppressed'),
    ]
    LEVEL_CHOICES = [
        ('warning', 'Warning'),
        ('alarm', 'Alarm'),
    ]

    rule = models.ForeignKey(AlarmRule, on_delete=models.CASCADE, related_name='events')
    tag_log = models.ForeignKey('core.TagLog', null=True, blank=True, on_delete=models.SET_NULL, related_name='alarm_events')
    level = models.CharField(max_length=8, choices=LEVEL_CHOICES)
    state = models.CharField(max_length=16, choices=STATE_CHOICES, default='active')
    triggered_value = models.FloatField()
    message = models.CharField(max_length=255, blank=True)
    triggered_at = models.DateTimeField(auto_now_add=True)
    returned_to_normal_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        'core.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='acknowledged_alarm_events',
    )
    ack_note = models.CharField(max_length=255, blank=True)
    shelved_until = models.DateTimeField(null=True, blank=True)
    shelved_by = models.ForeignKey(
        'core.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='shelved_alarm_events',
    )
    shelve_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-triggered_at']

    def __str__(self):
        return f"{self.rule.name} [{self.level}] - {self.state}"


class PlantArea(models.Model):
    """Logical plant zone for P&ID-style overview (areas aggregate alarms)."""

    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=120)
    sort_order = models.PositiveSmallIntegerField(default=0)
    layout = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('sort_order', 'code')

    def __str__(self):
        return self.name


class PlantEquipment(models.Model):
    """Equipment shown on plant overview; optional primary tag for live badge."""

    area = models.ForeignKey(PlantArea, on_delete=models.CASCADE, related_name='equipment')
    code = models.SlugField(max_length=64)
    name = models.CharField(max_length=120)
    primary_tag = models.ForeignKey(
        Tag,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='equipment_primary',
    )
    map_rect = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ('area_id', 'code')
        unique_together = [('area', 'code')]

    def __str__(self):
        return f'{self.area.code}:{self.code}'


class TrendAnnotation(models.Model):
    """Incident / maintenance marker on trend charts."""

    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name='trend_annotations')
    at = models.DateTimeField(db_index=True)
    label = models.CharField(max_length=120)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'core.User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='trend_annotations',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-at', '-id')

    def __str__(self):
        return f'{self.label} @ {self.at}'


class OperatorJournalEntry(models.Model):
    """Shift log / operator narrative tied to optional alarms or tags."""

    author = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='journal_entries')
    occurred_at = models.DateTimeField(db_index=True)
    title = models.CharField(max_length=200)
    body = models.TextField()
    related_alarm_event = models.ForeignKey(
        AlarmEvent,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='journal_entries',
    )
    related_tag = models.ForeignKey(
        Tag,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='journal_entries',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-occurred_at', '-id')

    def __str__(self):
        return self.title


class InAppNotification(models.Model):
    CATEGORY_ALARM_CRITICAL = 'alarm_critical'
    CATEGORY_COMPLAINT_SLA = 'complaint_sla'

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='in_app_notifications')
    category = models.CharField(max_length=32)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.category}: {self.title}'


class NotificationSubscription(models.Model):
    CHANNEL_EMAIL = 'email'
    CHANNEL_SMS = 'sms'
    CHANNEL_WEBHOOK = 'webhook'

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='notification_subscriptions')
    channel = models.CharField(max_length=16)
    destination = models.CharField(
        max_length=512,
        blank=True,
        help_text='Email address, phone E.164, or webhook URL depending on channel.',
    )
    notify_alarm_critical = models.BooleanField(default=True)
    notify_complaint_sla = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user.username} {self.channel}'


class ChatThread(models.Model):
    owner = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='chat_threads')
    title = models.CharField(max_length=200, default='New chat')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Thread {self.id} - {self.owner.username}"


class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('ai', 'AI'),
        ('system', 'System'),
    ]

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message {self.id} ({self.role})"


def chat_attachment_upload_path(instance, filename):
    return f"chat_attachments/user_{instance.thread.owner_id}/thread_{instance.thread_id}/{filename}"


class ChatAttachment(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='attachments')
    message = models.ForeignKey(
        ChatMessage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='attachments',
    )
    file = models.FileField(upload_to=chat_attachment_upload_path)
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Attachment {self.id} - {self.original_name}"


