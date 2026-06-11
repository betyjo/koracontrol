from rest_framework import serializers
from .models import (
    User,
    Tag,
    TagLog,
    Bill,
    Complaint,
    ChatThread,
    ChatMessage,
    ChatAttachment,
    PaymentTransaction,
    AIAnalysis,
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
    OperatorActionLog,
    AIFinding,
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

# 1. JWT Customization: Add user role to the token so the UI knows who is logged in
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role  # Add role to the JWT payload
        token['username'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
        }
        return data

# 2. User Serializer for Registration
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'role', 'phone_number')

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

# 3. Tag Serializers
class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'

class TagLogSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source='tag.name', read_only=True)

    class Meta:
        model = TagLog
        fields = ['tag', 'tag_name', 'value', 'quality_code', 'source_timestamp', 'timestamp']
        read_only_fields = ['timestamp']

class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'

class ComplaintSerializer(serializers.ModelSerializer):
    # We make status and user read_only so a customer can't fake them
    status = serializers.CharField(read_only=True)
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Complaint
        fields = [
            'id',
            'user',
            'subject',
            'description',
            'status',
            'priority',
            'created_at',
            'updated_at',
            'first_response_at',
        ]
        read_only_fields = ['id', 'user', 'status', 'created_at', 'updated_at', 'first_response_at']

    def create(self, validated_data):
        # Set default status to 'pending' for new complaints
        validated_data['status'] = 'pending'
        return super().create(validated_data)

class ComplaintUpdateSerializer(serializers.ModelSerializer):
    """ Used by Operators/Admins to change status """
    class Meta:
        model = Complaint
        fields = ['status']

# 4. User Profile & Security Serializers
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'phone_number', 'role')
        read_only_fields = ('id', 'role')

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True, min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": ["Passwords do not match."]})
        return attrs


class OperatorActionLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    tag_name = serializers.CharField(source='target_tag.name', read_only=True, default=None)

    class Meta:
        model = OperatorActionLog
        fields = [
            'id',
            'user',
            'username',
            'action_type',
            'target_tag',
            'tag_name',
            'description',
            'old_value',
            'new_value',
            'ip_address',
            'created_at',
        ]
        read_only_fields = ['user', 'created_at']


class AIFindingSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source='tag.name', read_only=True, default=None)

    class Meta:
        model = AIFinding
        fields = [
            'id',
            'finding_type',
            'tag',
            'tag_name',
            'alarm_event',
            'result_json',
            'created_at',
        ]
        read_only_fields = ['created_at']


class ChatThreadSerializer(serializers.ModelSerializer):
    last_message_preview = serializers.SerializerMethodField()

    class Meta:
        model = ChatThread
        fields = ['id', 'title', 'created_at', 'updated_at', 'last_message_preview']
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_preview']

    def get_last_message_preview(self, obj):
        last_message = obj.messages.order_by('-created_at').first()
        if not last_message:
            return ""
        return last_message.content[:120]


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'thread', 'role', 'content', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ChatAttachment
        fields = [
            'id',
            'thread',
            'message',
            'file',
            'file_url',
            'original_name',
            'mime_type',
            'size_bytes',
            'extracted_text',
            'created_at',
        ]
        read_only_fields = ['id', 'file_url', 'size_bytes', 'extracted_text', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if not obj.file:
            return None
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class PaymentTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTransaction
        fields = ["id", "tx_ref", "bill_id", "amount", "status", "created_at"]


class AIAnalysisSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source="tag.name", read_only=True)

    class Meta:
        model = AIAnalysis
        fields = [
            "id",
            "tag",
            "tag_name",
            "is_anomaly",
            "confidence_score",
            "explanation",
            "detected_at",
        ]


class AlarmRuleSerializer(serializers.ModelSerializer):
    tag_name = serializers.CharField(source='tag.name', read_only=True)

    class Meta:
        model = AlarmRule
        fields = [
            'id',
            'tag',
            'tag_name',
            'name',
            'is_enabled',
            'severity',
            'warning_high',
            'alarm_high',
            'warning_low',
            'alarm_low',
            'deadband',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class AlarmEventSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    tag_id = serializers.IntegerField(source='rule.tag_id', read_only=True)
    tag_name = serializers.CharField(source='rule.tag.name', read_only=True)
    acknowledged_by_username = serializers.SerializerMethodField(read_only=True)
    shelved_by_username = serializers.SerializerMethodField(read_only=True)
    severity = serializers.CharField(source='rule.severity', read_only=True)

    def get_acknowledged_by_username(self, obj):
        return obj.acknowledged_by.username if obj.acknowledged_by else None

    def get_shelved_by_username(self, obj):
        return obj.shelved_by.username if obj.shelved_by else None

    class Meta:
        model = AlarmEvent
        fields = [
            'id',
            'rule',
            'rule_name',
            'tag_id',
            'tag_name',
            'severity',
            'level',
            'state',
            'triggered_value',
            'message',
            'triggered_at',
            'returned_to_normal_at',
            'acknowledged_at',
            'acknowledged_by',
            'acknowledged_by_username',
            'ack_note',
            'shelved_until',
            'shelved_by',
            'shelved_by_username',
            'shelve_note',
        ]
        read_only_fields = [
            'triggered_at',
            'returned_to_normal_at',
            'acknowledged_at',
            'acknowledged_by',
            'shelved_by',
        ]


class AlarmAcknowledgeSerializer(serializers.Serializer):
    ack_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class AlarmShelveSerializer(serializers.Serializer):
    minutes = serializers.IntegerField(required=False, min_value=1, max_value=1440, default=30)
    shelve_note = serializers.CharField(required=False, allow_blank=True, max_length=255)


class PlantEquipmentSerializer(serializers.ModelSerializer):
    primary_tag_name = serializers.SerializerMethodField(read_only=True)

    def get_primary_tag_name(self, obj):
        return obj.primary_tag.name if obj.primary_tag else None

    class Meta:
        model = PlantEquipment
        fields = ['id', 'area', 'code', 'name', 'primary_tag', 'primary_tag_name', 'map_rect']


class MaintenanceTaskSerializer(serializers.ModelSerializer):
    asset_name = serializers.SerializerMethodField(read_only=True)
    created_by_username = serializers.SerializerMethodField(read_only=True)
    assigned_to_username = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = MaintenanceTask
        fields = [
            'id',
            'asset',
            'asset_name',
            'title',
            'description',
            'status',
            'priority',
            'created_by',
            'created_by_username',
            'assigned_to',
            'assigned_to_username',
            'planned_start',
            'planned_end',
            'completed_at',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_asset_name(self, obj):
        return obj.asset.name if obj.asset else None

    def get_created_by_username(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_assigned_to_username(self, obj):
        return obj.assigned_to.username if obj.assigned_to else None

    def create(self, validated_data):
        user = self.context['request'].user
        return MaintenanceTask.objects.create(created_by=user, **validated_data)


class ProcessSetpointSerializer(serializers.ModelSerializer):
    tag_name = serializers.SerializerMethodField(read_only=True)

    def get_tag_name(self, obj):
        return obj.tag.name if obj.tag else None

    class Meta:
        model = ProcessSetpoint
        fields = [
            'id',
            'tag',
            'tag_name',
            'target_value',
            'tolerance',
            'mode',
            'description',
            'effective_from',
            'effective_until',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class WaterQualityMetricSerializer(serializers.ModelSerializer):
    area_name = serializers.SerializerMethodField(read_only=True)
    tag_name = serializers.SerializerMethodField(read_only=True)

    def get_area_name(self, obj):
        return obj.area.name if obj.area else None

    def get_tag_name(self, obj):
        return obj.tag.name if obj.tag else None

    class Meta:
        model = WaterQualityMetric
        fields = [
            'id',
            'area',
            'area_name',
            'tag',
            'tag_name',
            'metric_name',
            'current_value',
            'unit',
            'status',
            'threshold_low',
            'threshold_high',
            'last_updated',
            'created_at',
        ]
        read_only_fields = ['last_updated', 'created_at']


class EquipmentHealthSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model = EquipmentHealth
        fields = [
            'id',
            'equipment',
            'equipment_name',
            'health_score',
            'condition',
            'last_inspection_at',
            'next_due_at',
            'recommended_action',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class TrendAnnotationSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = TrendAnnotation
        fields = [
            'id',
            'tag',
            'at',
            'label',
            'notes',
            'created_by',
            'author_username',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']


class OperatorJournalEntrySerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = OperatorJournalEntry
        fields = [
            'id',
            'author',
            'author_username',
            'occurred_at',
            'title',
            'body',
            'related_alarm_event',
            'related_tag',
            'created_at',
        ]
        read_only_fields = ['author', 'created_at']


class InAppNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InAppNotification
        fields = ['id', 'category', 'title', 'body', 'payload', 'read_at', 'created_at']
        read_only_fields = ['category', 'title', 'body', 'payload', 'created_at']


class NotificationSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSubscription
        fields = [
            'id',
            'channel',
            'destination',
            'notify_alarm_critical',
            'notify_complaint_sla',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def validate(self, attrs):
        inst = self.instance
        channel = attrs.get('channel')
        if channel is None and inst:
            channel = inst.channel
        dest = attrs.get('destination')
        if dest is None and inst:
            dest = inst.destination
        dest = (dest or '').strip()
        if channel == NotificationSubscription.CHANNEL_WEBHOOK and not dest:
            raise serializers.ValidationError({'destination': 'Webhook channel requires a destination URL.'})
        return attrs
