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
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp'] # Latest data first

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


