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
    class Meta:
        model = TagLog
        fields = ['tag', 'value', 'timestamp']

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
        fields = ['id', 'user', 'subject', 'description', 'status', 'priority', 'created_at']

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
