from rest_framework import serializers
from .models import User, Tag, TagLog, Bill, Complaint
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
