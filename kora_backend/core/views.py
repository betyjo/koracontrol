from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from collections import defaultdict

from .dashboard_viz import gauge_needle_degrees, normalized_ratio, status_level_for_value
from .alarm_evaluator import evaluate_alarm_for_log
from .mqtt_service import publish_alarm_notification
from .models import User, Tag, TagLog, DashboardVisualization, AlarmRule, AlarmEvent, TrendAnnotation, OperatorJournalEntry, InAppNotification, NotificationSubscription, PlantArea, PlantEquipment, Bill, PaymentTransaction, Complaint, AIAnalysis, ChatThread, ChatMessage, ChatAttachment, OperatorActionLog, AIFinding, ProcessSetpoint, EquipmentHealth, WaterQualityMetric
from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    TagSerializer, TagLogSerializer, UserSerializer, ChangePasswordSerializer,
    ForgotPasswordRequestSerializer, ResetPasswordSerializer,
    AlarmRuleSerializer, AlarmEventSerializer, AlarmAcknowledgeSerializer, AlarmShelveSerializer,
    OperatorJournalEntrySerializer,
    InAppNotificationSerializer, NotificationSubscriptionSerializer, PlantEquipmentSerializer,
    OperatorActionLogSerializer, AIFindingSerializer,
)
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Sum, Avg, Count, Q, Max
from django.utils import timezone
from datetime import timedelta, datetime
import calendar
import csv
import io
import json
import mimetypes
import time
from django.http import StreamingHttpResponse, HttpResponse

# --- AUTH VIEWS ---

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser

class BiometricLoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, *args, **kwargs):
        from .biometric_face import check_dependencies, match_face

        dependency_error = check_dependencies()
        if dependency_error:
            return Response({"error": dependency_error}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        image_b64 = request.data.get('image')
        if not image_b64:
            return Response({"error": "No image uploaded"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import binascii
            import base64

            try:
                image_data = base64.b64decode(image_b64, validate=True)
            except (ValueError, binascii.Error):
                return Response({"error": "Invalid image data"}, status=status.HTTP_400_BAD_REQUEST)

            if not image_data:
                return Response({"error": "Empty image data"}, status=status.HTTP_400_BAD_REQUEST)

            candidates = []
            for user in User.objects.exclude(face_encoding__isnull=True):
                if not user.face_encoding or len(user.face_encoding) != 128:
                    continue
                candidates.append({
                    "user_id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "encoding": user.face_encoding,
                })

            if not candidates:
                return Response(
                    {"error": "No Face ID profiles are enrolled. Upload operator photos in admin."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            result = match_face(image_data, candidates)

            if result.get("ok"):
                user = User.objects.get(pk=result["user_id"])
                refresh = MyTokenObtainPairSerializer.get_token(user)
                return Response({
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": user.role,
                    },
                }, status=status.HTTP_200_OK)

            code = result.get("code", "worker_failed")
            if code == "no_face":
                return Response(
                    {"error": "No face found in image. Center your face and try again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if code == "bad_image":
                return Response({"error": "Could not read image file"}, status=status.HTTP_400_BAD_REQUEST)
            if code == "not_recognized":
                return Response({"error": "Face not recognized"}, status=status.HTTP_401_UNAUTHORIZED)
            if code == "timeout":
                return Response(
                    {"error": "Face recognition timed out. Please try again."},
                    status=status.HTTP_504_GATEWAY_TIMEOUT,
                )

            detail = result.get("detail") or "Face recognition worker failed"
            return Response(
                {"error": f"Face recognition failed: {detail}"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        except User.DoesNotExist:
            return Response({"error": "Matched user no longer exists"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except ImportError:
            return Response(
                {"error": "Face recognition is not installed on the server"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Biometric login failed")
            return Response(
                {"error": "Face recognition failed. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,) # Anyone can register
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"message": "User registered successfully"},
            status=status.HTTP_201_CREATED,
            headers=headers
        )


class ForgotPasswordRequestView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = ForgotPasswordRequestSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        user = User.objects.filter(email=email).first()

        # Avoid user enumeration by returning the same response shape.
        response_data = {
            "message": "If an account exists for this email, password reset instructions were generated."
        }

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            response_data.update(
                {
                    "uid": uid,
                    "token": token,
                }
            )

        return Response(response_data, status=status.HTTP_200_OK)


class ResetPasswordView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = ResetPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({"detail": "Invalid reset link."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({"detail": "Reset token is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password reset successful. You can now log in."}, status=status.HTTP_200_OK)

import requests
from django.conf import settings
from rest_framework.views import APIView

class GoogleAuthView(APIView):
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request):
        code = request.data.get("code")
        if not code:
            return Response({"error": "No code provided"}, status=400)

        # 1. Exchange code for tokens
        token_res = requests.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        token_data = token_res.json()

        if "error" in token_data:
            return Response({"error": token_data.get("error_description", token_data["error"])}, status=400)

        # 2. Get user info from Google
        user_info = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={
            "Authorization": f"Bearer {token_data['access_token']}"
        }).json()

        email = user_info.get("email")
        name = user_info.get("name", "")
        
        if not email:
            return Response({"error": "Google authentication failed. No email provided."}, status=400)

        # 3. Get or create user
        # Standard web app behavior: derive username from email prefix
        base_username = email.split('@')[0]
        
        try:
            # If user exists with this email, standard behavior is to link it
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Create new user with unique username
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            user = User.objects.create(
                email=email,
                username=username,
                first_name=name.split()[0] if name else "",
                last_name=name.split()[-1] if len(name.split()) > 1 else ""
            )

        # 4. Return JWT tokens (same claims as password login, including role)
        refresh = MyTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role if hasattr(user, 'role') else 'user'
            }
        })


# --- INDUSTRIAL API VIEWS ---

class TagListView(generics.ListCreateAPIView):
    """
    Team 1 uses this to:
    1. See all defined tags (GET)
    2. Create a new tag definition (POST)
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.AllowAny]

class TagLogListCreateView(generics.ListCreateAPIView):
    """
    Team 1 uses this to send actual PLC values.
    Endpoint: /api/logs/
    """
    permission_classes = [permissions.AllowAny]  # Allow access for testing
    serializer_class = TagLogSerializer

    def get_queryset(self):
        # Prevent N+1 queries by selecting related tag
        qs = TagLog.objects.select_related('tag').order_by('-timestamp')
        
        # Support tag_name filtering if passed
        tag_name = self.request.query_params.get('tag_name')
        if tag_name:
            qs = qs.filter(tag__name=tag_name)
            
        # Limit results to latest 200 logs to prevent huge serialization/network payloads.
        # This resolves the 14-second loading times for the main dashboard.
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                return qs[:int(limit)]
            except ValueError:
                pass
        return qs[:200]

    def create(self, request, *args, **kwargs):
        is_bulk = isinstance(request.data, list)
        serializer = self.get_serializer(data=request.data, many=is_bulk)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        created_logs = serializer.instance if is_bulk else [serializer.instance]
        for log in created_logs:
            evaluate_alarm_for_log(log)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


from django.shortcuts import get_object_or_404
from django.urls import reverse

from django.conf import settings as django_conf
from .models import Bill, PaymentTransaction, Complaint
from .chapa_service import (
    initialize_chapa_payment,
    ChapaConfigurationError,
    ChapaRequestError,
)
from .serializers import (
    BillSerializer,
    ComplaintSerializer,
    ComplaintUpdateSerializer,
    PaymentTransactionSerializer,
    AIAnalysisSerializer,
)
from .serializers import ChatThreadSerializer, ChatMessageSerializer, ChatAttachmentSerializer
from django.db import transaction

# --- BILLING VIEWS ---

class BillListView(generics.ListAPIView):
    serializer_class = BillSerializer # You'll need to add this to serializers.py
    def get_queryset(self):
        # Customers only see their own bills
        return Bill.objects.filter(user=self.request.user)

# --- PAYMENT VIEWS ---

class InitiatePaymentView(generics.GenericAPIView):
    def post(self, request, bill_id):
        bill = get_object_or_404(Bill, id=bill_id, user=request.user)

        payment_tx = PaymentTransaction.objects.create(
            user=request.user,
            bill=bill,
            amount=bill.amount,
        )

        frontend = getattr(django_conf, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
        return_url = f"{frontend}/dashboard/billing"
        callback_url = request.build_absolute_uri(
            reverse("pay_callback", kwargs={"tx_ref": str(payment_tx.tx_ref)})
        )

        try:
            body = initialize_chapa_payment(
                payment_tx,
                callback_url=callback_url,
                return_url=return_url,
            )
        except ChapaConfigurationError as exc:
            return Response({"error": str(exc)}, status=503)
        except ChapaRequestError as exc:
            return Response({"error": str(exc)}, status=502)

        checkout_url = (body.get("data") or {}).get("checkout_url")
        if not checkout_url:
            return Response(
                {"error": "Chapa response missing checkout URL."},
                status=502,
            )
        return Response({"checkout_url": checkout_url, "tx_ref": payment_tx.tx_ref})

class PaymentCallbackView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny] # Chapa calls this, no JWT needed

    def get(self, request, tx_ref):
        """
        Secure verification by calling Chapa's Verify API.
        """
        import requests
        
        transaction = get_object_or_404(PaymentTransaction, tx_ref=tx_ref)
        
        # Don't verify twice if already successful
        if transaction.status == 'success':
            return Response({"message": "Payment already verified"})

        secret = getattr(django_conf, "CHAPA_SECRET_KEY", "").strip()
        if not secret:
            # Fallback for local mock testing if no key is present
            transaction.status = 'success'
            transaction.save()
            transaction.bill.is_paid = True
            transaction.bill.save()
            return Response({"message": "Mock payment verified"})

        headers = {
            "Authorization": f"Bearer {secret}",
        }
        
        verify_url = f"https://api.chapa.co/v1/transaction/verify/{tx_ref}"
        
        try:
            response = requests.get(verify_url, headers=headers, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('status') == 'success':
                # Payment was actually successful!
                transaction.status = 'success'
                transaction.save()
                
                transaction.bill.is_paid = True
                transaction.bill.save()
                return Response({"message": "Payment verified securely and bill updated"})
            else:
                transaction.status = 'failed'
                transaction.save()
                return Response({"error": "Payment verification failed"}, status=400)
                
        except Exception as e:
            return Response({"error": "Failed to reach Chapa verification API"}, status=502)

class ComplaintListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]  # Allow access for testing
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'operator']:
            return Complaint.objects.all() # Staff sees everything
        return Complaint.objects.filter(user=user) # Customers see only theirs

    def perform_create(self, serializer):
        # Automatically assign the complaint to the logged-in user
        serializer.save(user=self.request.user)

class ComplaintDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Complaint.objects.all()
    
    def get_serializer_class(self):
        if self.request.user.role in ['admin', 'operator']:
            return ComplaintUpdateSerializer
        return ComplaintSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'operator']:
            return Complaint.objects.all()
        return Complaint.objects.filter(user=user)

    def perform_destroy(self, instance):
        # Ensure users can only delete their own complaints
        if self.request.user.role == 'customer' and instance.user != self.request.user:
            raise permissions.PermissionDenied("You can only delete your own complaints.")
        instance.delete()

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        prev_status = instance.status
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save()
        if (
            prev_status == 'pending'
            and complaint.status == 'investigating'
            and complaint.first_response_at is None
        ):
            complaint.first_response_at = timezone.now()
            complaint.save(update_fields=['first_response_at'])
        complaint.refresh_from_db()
        return Response(self.get_serializer(complaint).data)


class AlarmRuleListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlarmRuleSerializer
    queryset = AlarmRule.objects.select_related('tag').all()

    def get_queryset(self):
        qs = super().get_queryset()
        tag_id = self.request.query_params.get('tag_id')
        if tag_id:
            qs = qs.filter(tag_id=tag_id)
        if self.request.user.role == 'customer':
            return qs.filter(is_enabled=True)
        return qs

    def perform_create(self, serializer):
        if self.request.user.role not in ['admin', 'operator']:
            raise permissions.PermissionDenied("Only admins/operators can create alarm rules.")
        serializer.save()


class AlarmEventListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlarmEventSerializer

    def get_queryset(self):
        qs = AlarmEvent.objects.select_related('rule', 'rule__tag', 'acknowledged_by', 'shelved_by')
        state = self.request.query_params.get('state')
        severity = self.request.query_params.get('severity')
        tag_id = self.request.query_params.get('tag_id')
        if state:
            qs = qs.filter(state=state)
        if severity:
            qs = qs.filter(rule__severity=severity)
        if tag_id:
            qs = qs.filter(rule__tag_id=tag_id)
        return qs


class AlarmAcknowledgeView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlarmAcknowledgeSerializer

    def post(self, request, event_id):
        if request.user.role not in ['admin', 'operator'] and not request.user.is_staff and not request.user.is_superuser:
            return Response({"detail": "Only admins/operators can acknowledge alarms."}, status=403)

        event = get_object_or_404(AlarmEvent, id=event_id)
        if event.state in ['returned', 'suppressed']:
            return Response({"detail": f"Cannot acknowledge an event in '{event.state}' state."}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event.state = 'acknowledged'
        event.acknowledged_at = timezone.now()
        event.acknowledged_by = request.user
        event.ack_note = serializer.validated_data.get('ack_note', '')
        event.save(update_fields=['state', 'acknowledged_at', 'acknowledged_by', 'ack_note'])
        
        # Publish alarm notification to MQTT
        try:
            alarm_data = {
                'id': event.id,
                'rule_id': event.rule.id,
                'rule_name': event.rule.name,
                'tag_id': event.tag_id,
                'tag_name': event.tag_name,
                'severity': event.rule.severity,
                'level': event.level,
                'state': event.state,
                'triggered_value': event.triggered_value,
                'message': event.message,
                'triggered_at': event.triggered_at.isoformat() if event.triggered_at else None,
                'acknowledged_at': event.acknowledged_at.isoformat() if event.acknowledged_at else None,
                'acknowledged_by': event.acknowledged_by.username if event.acknowledged_by else None,
            }
            publish_alarm_notification(alarm_data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish alarm acknowledgment notification: {e}")
        
        return Response(AlarmEventSerializer(event).data)


class AlarmShelveView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlarmShelveSerializer

    def post(self, request, event_id):
        if request.user.role not in ['admin', 'operator'] and not request.user.is_staff and not request.user.is_superuser:
            return Response({"detail": "Only admins/operators can shelve alarms."}, status=403)

        event = get_object_or_404(AlarmEvent, id=event_id)
        if event.state == 'returned':
            return Response({"detail": "Cannot shelve a returned event."}, status=400)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        minutes = serializer.validated_data.get('minutes', 30)
        event.state = 'shelved'
        event.shelved_by = request.user
        event.shelve_note = serializer.validated_data.get('shelve_note', '')
        event.shelved_until = timezone.now() + timedelta(minutes=minutes)
        event.save(update_fields=['state', 'shelved_by', 'shelve_note', 'shelved_until'])
        
        # Publish alarm notification to MQTT
        try:
            alarm_data = {
                'id': event.id,
                'rule_id': event.rule.id,
                'rule_name': event.rule.name,
                'tag_id': event.tag_id,
                'tag_name': event.tag_name,
                'severity': event.rule.severity,
                'level': event.level,
                'state': event.state,
                'triggered_value': event.triggered_value,
                'message': event.message,
                'triggered_at': event.triggered_at.isoformat() if event.triggered_at else None,
                'shelved_until': event.shelved_until.isoformat() if event.shelved_until else None,
                'shelved_by': event.shelved_by.username if event.shelved_by else None,
            }
            publish_alarm_notification(alarm_data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish alarm shelve notification: {e}")
        
        return Response(AlarmEventSerializer(event).data)


class AlarmUnshelveView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, event_id):
        if request.user.role not in ['admin', 'operator'] and not request.user.is_staff and not request.user.is_superuser:
            return Response({"detail": "Only admins/operators can unshelve alarms."}, status=403)

        event = get_object_or_404(AlarmEvent, id=event_id)
        if event.state != 'shelved':
            return Response({"detail": "Event is not shelved."}, status=400)

        next_state = 'acknowledged' if event.acknowledged_at else 'active'
        event.state = next_state
        event.shelved_until = None
        event.save(update_fields=['state', 'shelved_until'])
        
        # Publish alarm notification to MQTT
        try:
            alarm_data = {
                'id': event.id,
                'rule_id': event.rule.id,
                'rule_name': event.rule.name,
                'tag_id': event.tag_id,
                'tag_name': event.tag_name,
                'severity': event.rule.severity,
                'level': event.level,
                'state': event.state,
                'triggered_value': event.triggered_value,
                'message': event.message,
                'triggered_at': event.triggered_at.isoformat() if event.triggered_at else None,
            }
            publish_alarm_notification(alarm_data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to publish alarm unshelve notification: {e}")
        
        return Response(AlarmEventSerializer(event).data)


class AlarmKPIView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        active_states = ['active', 'acknowledged', 'shelved']
        base_qs = AlarmEvent.objects.select_related('rule')
        standing_alarms = base_qs.filter(state__in=active_states).count()
        critical_open = base_qs.filter(state__in=active_states, rule__severity='critical').count()
        acknowledged = base_qs.filter(acknowledged_at__isnull=False).count()
        total = base_qs.count()
        ack_rate = round((acknowledged / total) * 100, 2) if total else 0

        return Response(
            {
                "standing_alarms": standing_alarms,
                "critical_open": critical_open,
                "total_events": total,
                "acknowledged_events": acknowledged,
                "ack_rate_percent": ack_rate,
            }
        )

# --- AI & ANALYTICS VIEWS ---

from .ai_service import run_anomaly_detection, get_ai_chat_response
from .ai_service import stream_ai_chat_response
from .models import TagLog, AIAnalysis, ChatThread, ChatMessage, ChatAttachment

class AIAnalyzeView(generics.GenericAPIView):
    def post(self, request):
        tag_id = request.data.get('tag_id')
        tag = get_object_or_404(Tag, id=tag_id)
        
        # 1. Get recent data for this tag
        recent_data = TagLog.objects.filter(tag=tag).order_by('-timestamp')[:10]
        
        # 2. Run the AI service
        is_anomaly, confidence, explanation = run_anomaly_detection(recent_data)
        
        # 3. Save the analysis
        analysis = AIAnalysis.objects.create(
            tag=tag,
            is_anomaly=is_anomaly,
            confidence_score=confidence,
            explanation=explanation
        )
        
        return Response({
            "is_anomaly": is_anomaly,
            "confidence": confidence,
            "explanation": explanation,
            "status": "Warning" if is_anomaly else "Healthy"
        })


class PaymentTransactionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentTransactionSerializer

    def get_queryset(self):
        return PaymentTransaction.objects.filter(user=self.request.user).select_related(
            "bill"
        ).order_by("-created_at")


class AIAnalysisListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AIAnalysisSerializer
    queryset = AIAnalysis.objects.select_related("tag").order_by("-detected_at")


class AIChatView(generics.GenericAPIView):
    def post(self, request):
        user_message = request.data.get('message', '')
        try:
            ai_response = get_ai_chat_response(user_message)
            return Response({
                "response": ai_response,
                "note": "AI Assistant is currently in beta."
            })
        except Exception:
            return Response(
                {
                    "response": "AI service is temporarily unavailable. Please try again shortly.",
                    "note": "AI Assistant is currently in beta."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )


class AIThreadListCreateView(generics.ListCreateAPIView):
    serializer_class = ChatThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatThread.objects.filter(owner=self.request.user, is_deleted=False)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class AIThreadDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChatThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChatThread.objects.filter(owner=self.request.user, is_deleted=False)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted', 'updated_at'])


class AIThreadMessageListView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_thread(self):
        return get_object_or_404(
            ChatThread,
            id=self.kwargs['thread_id'],
            owner=self.request.user,
            is_deleted=False
        )

    def get_queryset(self):
        return ChatMessage.objects.filter(thread=self.get_thread())

    def create(self, request, *args, **kwargs):
        thread = self.get_thread()
        user_message = (request.data.get('message') or '').strip()
        if not user_message:
            return Response({"detail": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ChatMessage.objects.create(thread=thread, role='user', content=user_message)
            history = list(ChatMessage.objects.filter(thread=thread).order_by('-created_at')[:12])
            history.reverse()
            attachments = ChatAttachment.objects.filter(thread=thread).order_by('-created_at')[:4]
            attachment_texts = [a.extracted_text for a in attachments if a.extracted_text]
            ai_response = get_ai_chat_response(
                user_message=user_message,
                user=request.user,
                history_messages=history,
                attachment_texts=attachment_texts,
            )
            ai_message = ChatMessage.objects.create(thread=thread, role='ai', content=ai_response)
            thread.updated_at = timezone.now()
            thread.save(update_fields=['updated_at'])

        return Response(
            {"user_message": user_message, "ai_message": ChatMessageSerializer(ai_message).data},
            status=status.HTTP_201_CREATED
        )


class AIThreadStreamView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, thread_id):
        thread = get_object_or_404(ChatThread, id=thread_id, owner=request.user, is_deleted=False)
        user_message = (request.data.get('message') or '').strip()
        if not user_message:
            return Response({"detail": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

        user_msg = ChatMessage.objects.create(thread=thread, role='user', content=user_message)
        history = list(ChatMessage.objects.filter(thread=thread).order_by('-created_at')[:12])
        history.reverse()
        attachments = ChatAttachment.objects.filter(thread=thread).order_by('-created_at')[:4]
        attachment_texts = [a.extracted_text for a in attachments if a.extracted_text]

        def event_stream():
            chunks = []
            for chunk in stream_ai_chat_response(
                user_message=user_message,
                user=request.user,
                history_messages=history,
                attachment_texts=attachment_texts,
            ):
                chunks.append(chunk)
                payload = json.dumps({"type": "chunk", "text": chunk})
                yield f"data: {payload}\n\n"

            full_text = "".join(chunks).strip()
            ai_msg = ChatMessage.objects.create(thread=thread, role='ai', content=full_text)
            thread.updated_at = timezone.now()
            thread.save(update_fields=['updated_at'])
            payload = json.dumps(
                {
                    "type": "done",
                    "message_id": ai_msg.id,
                    "user_message_id": user_msg.id,
                }
            )
            yield f"data: {payload}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        return response


class AIThreadAttachmentUploadView(generics.CreateAPIView):
    serializer_class = ChatAttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    ALLOWED_TYPES = {
        'image/png',
        'image/jpeg',
        'application/pdf',
        'text/plain',
        'text/csv',
    }
    MAX_FILE_SIZE = 10 * 1024 * 1024

    def _extract_text(self, uploaded_file, mime_type):
        if mime_type in {'text/plain', 'text/csv'}:
            uploaded_file.seek(0)
            return uploaded_file.read().decode('utf-8', errors='ignore')[:12000]
        if mime_type == 'application/pdf':
            try:
                from pypdf import PdfReader
                uploaded_file.seek(0)
                reader = PdfReader(uploaded_file)
                text = "\n".join((page.extract_text() or "") for page in reader.pages[:10])
                return text[:12000]
            except Exception:
                return ""
        return ""

    def create(self, request, *args, **kwargs):
        thread = get_object_or_404(ChatThread, id=self.kwargs['thread_id'], owner=request.user, is_deleted=False)
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"detail": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

        mime_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name)[0] or ''
        if mime_type not in self.ALLOWED_TYPES:
            return Response({"detail": f"Unsupported file type: {mime_type}"}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded_file.size > self.MAX_FILE_SIZE:
            return Response({"detail": "File too large. Max size is 10MB."}, status=status.HTTP_400_BAD_REQUEST)

        extracted_text = self._extract_text(uploaded_file, mime_type)
        uploaded_file.seek(0)
        attachment = ChatAttachment.objects.create(
            thread=thread,
            file=uploaded_file,
            original_name=uploaded_file.name,
            mime_type=mime_type,
            size_bytes=uploaded_file.size,
            extracted_text=extracted_text,
        )
        serializer = self.get_serializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AIThreadExportView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, thread_id):
        thread = get_object_or_404(ChatThread, id=thread_id, owner=request.user, is_deleted=False)
        export_format = request.query_params.get('format', 'json')
        messages = list(thread.messages.all())

        if export_format == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['id', 'role', 'content', 'created_at'])
            for msg in messages:
                writer.writerow([msg.id, msg.role, msg.content, msg.created_at.isoformat()])
            response = HttpResponse(output.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="chat-thread-{thread.id}.csv"'
            return response

        payload = {
            "thread": ChatThreadSerializer(thread).data,
            "messages": ChatMessageSerializer(messages, many=True).data,
            "attachments": ChatAttachmentSerializer(thread.attachments.all(), many=True, context={'request': request}).data,
        }
        response = HttpResponse(json.dumps(payload, indent=2), content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="chat-thread-{thread.id}.json"'
        return response

# --- DASHBOARD ANALYTICS VIEWS ---


class DashboardKpiSummaryView(generics.GenericAPIView):
    """Live process KPIs: peak/avg/min flow, water balance, pump status, quality."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Max, Min, Avg, Sum
        now = timezone.now()
        cutoff_24h = now - timedelta(hours=24)

        # Flow rate stats
        flow_logs = TagLog.objects.filter(
            tag__name__icontains='flow',
            timestamp__gte=cutoff_24h,
        ).aggregate(
            peak=Max('value'),
            avg=Avg('value'),
            minimum=Min('value'),
            count=Sum('value'),
        )

        # Tank level stats (water balance proxy)
        tank_logs = TagLog.objects.filter(
            tag__name__icontains='tank',
            timestamp__gte=cutoff_24h,
        ).order_by('-timestamp')
        latest_tank = tank_logs.first()
        earliest_tank = tank_logs.last()
        water_balance = 0.0
        if latest_tank and earliest_tank:
            water_balance = round(latest_tank.value - earliest_tank.value, 2)

        # Quality percentage
        total_quality_logs = TagLog.objects.filter(timestamp__gte=cutoff_24h).count()
        good_quality_logs = TagLog.objects.filter(
            timestamp__gte=cutoff_24h,
            quality_code='good',
        ).count()
        quality_pct = round((good_quality_logs / total_quality_logs) * 100, 1) if total_quality_logs else 100.0

        # Pump status (on/off from Main_Pump or similar tag)
        pump_log = TagLog.objects.filter(
            tag__name__icontains='pump',
        ).order_by('-timestamp').first()
        pump_running = pump_log.value > 0 if pump_log else None

        # Active alarms count
        from .models import AlarmEvent
        active_alarms = AlarmEvent.objects.filter(state__in=['active', 'acknowledged', 'shelved']).count()

        # Recent operator events
        recent_journal = list(
            OperatorJournalEntry.objects.select_related('author')
            .order_by('-occurred_at')[:5]
            .values('id', 'title', 'occurred_at', 'author__username')
        )

        return Response({
            'flow_peak': round(flow_logs['peak'] or 0, 2),
            'flow_avg': round(flow_logs['avg'] or 0, 2),
            'flow_min': round(flow_logs['minimum'] or 0, 2),
            'flow_total_24h': round(flow_logs['count'] or 0, 2),
            'water_balance': water_balance,
            'quality_pct': quality_pct,
            'pump_running': pump_running,
            'active_alarms': active_alarms,
            'recent_operator_events': [
                {
                    'id': e['id'],
                    'title': e['title'],
                    'occurred_at': e['occurred_at'].isoformat() if e['occurred_at'] else None,
                    'author': e['author__username'],
                }
                for e in recent_journal
            ],
        })


class BillForecastView(generics.GenericAPIView):
    """Estimate next bill based on recent usage trend."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get latest bills
        recent_bills = Bill.objects.filter(user=user).order_by('-billing_date')[:6]
        if not recent_bills.exists():
            return Response({'forecast_amount': 0, 'confidence': 'low', 'usage_trend': []})

        bills_list = list(recent_bills)
        avg_amount = sum(float(b.amount) for b in bills_list) / len(bills_list)
        avg_usage = sum(float(b.usage_kwh) for b in bills_list) / len(bills_list)

        # Simple trend: compare last 2 bills vs previous ones
        if len(bills_list) >= 3:
            recent_avg = sum(float(b.amount) for b in bills_list[:2]) / 2
            older_avg = sum(float(b.amount) for b in bills_list[2:]) / max(1, len(bills_list) - 2)
            trend_pct = round(((recent_avg - older_avg) / max(older_avg, 1)) * 100, 1)
        else:
            trend_pct = 0.0
            recent_avg = avg_amount

        forecast = round(recent_avg * (1 + trend_pct / 200), 2)  # dampen trend

        # User's rate
        rate = float(user.billing_rate) if hasattr(user, 'billing_rate') else 1.50

        return Response({
            'forecast_amount': forecast,
            'forecast_usage': round(avg_usage * (1 + trend_pct / 200), 2),
            'rate_per_unit': rate,
            'trend_pct': trend_pct,
            'avg_amount': round(avg_amount, 2),
            'confidence': 'high' if len(bills_list) >= 4 else 'medium' if len(bills_list) >= 2 else 'low',
            'usage_trend': [
                {'month': b.billing_date.strftime('%b'), 'amount': float(b.amount), 'usage': float(b.usage_kwh)}
                for b in reversed(bills_list)
            ],
        })


class ServiceOutageView(generics.GenericAPIView):
    """Return current/active service outage notifications."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Look for alarm events with critical severity that are still active
        from .models import AlarmEvent
        outages = AlarmEvent.objects.filter(
            state__in=['active', 'acknowledged'],
            rule__severity__in=['critical', 'high'],
        ).select_related('rule', 'rule__tag').order_by('-triggered_at')[:10]

        result = []
        for ev in outages:
            result.append({
                'id': ev.id,
                'title': ev.rule.name,
                'severity': ev.rule.severity,
                'message': ev.message or f'{ev.rule.tag.name} triggered at ev.triggered_at',
                'triggered_at': ev.triggered_at.isoformat(),
                'state': ev.state,
            })

        return Response({'outages': result, 'count': len(result)})


class UsageComparisonView(generics.GenericAPIView):
    """Compare current usage vs previous period for customer."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

        this_month_bills = Bill.objects.filter(
            user=user, billing_date__gte=this_month_start
        ).aggregate(total_usage=Sum('usage_kwh'), total_cost=Sum('amount'))

        last_month_bills = Bill.objects.filter(
            user=user,
            billing_date__gte=last_month_start,
            billing_date__lt=this_month_start,
        ).aggregate(total_usage=Sum('usage_kwh'), total_cost=Sum('amount'))

        this_usage = float(this_month_bills['total_usage'] or 0)
        last_usage = float(last_month_bills['total_usage'] or 0)
        this_cost = float(this_month_bills['total_cost'] or 0)
        last_cost = float(last_month_bills['total_cost'] or 0)

        change_pct = round(((this_usage - last_usage) / max(last_usage, 1)) * 100, 1) if last_usage else 0.0

        return Response({
            'this_month': {'usage': this_usage, 'cost': this_cost},
            'last_month': {'usage': last_usage, 'cost': last_cost},
            'change_pct': change_pct,
        })


class DashboardVizLiveView(generics.GenericAPIView):
    """
    Admin-controlled SCADA visuals: latest values, derived status levels,
    normalized fill for tanks/gauges, and rolling 60s series for trends.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        panels_cfg = (
            DashboardVisualization.objects.filter(is_active=True)
            .select_related('tag')
            .order_by('sort_order', 'id')
        )
        now = timezone.now()

        panels = list(panels_cfg)
        if not panels:
            return Response({'panels': [], 'refreshed_at': now.isoformat()})

        tag_ids = list({p.tag_id for p in panels})
        cutoff = now - timedelta(seconds=60)

        latest_map = {}
        for tid in tag_ids:
            row = TagLog.objects.filter(tag_id=tid).only('value', 'timestamp').first()
            if row:
                latest_map[tid] = row

        trend_tag_ids = {p.tag_id for p in panels if p.widget_type == 'trend'}
        trend_buckets = defaultdict(list)
        if trend_tag_ids:
            recent = (
                TagLog.objects.filter(
                    tag_id__in=list(trend_tag_ids),
                    timestamp__gte=cutoff,
                )
                .order_by('timestamp')
                .values_list('tag_id', 'timestamp', 'value')
            )
            for tid, ts, val in recent:
                trend_buckets[int(tid)].append((ts.isoformat(), float(val)))

        out = []
        for panel in panels:
            latest = latest_map.get(panel.tag_id)
            val = latest.value if latest else None

            ratio = normalized_ratio(val, panel.scale_min, panel.scale_max)
            st_level = status_level_for_value(
                val,
                panel.alarm_high,
                panel.alarm_low,
                panel.warning_high,
                panel.warning_low,
            )
            needle = gauge_needle_degrees(ratio) if ratio is not None else None

            series_pts = [{'t': tp[0], 'value': tp[1]} for tp in trend_buckets.get(panel.tag_id, [])]
            series_pts = series_pts[-720:]

            out.append(
                {
                    'id': panel.id,
                    'widget_type': panel.widget_type,
                    'title': (panel.title or '').strip() or panel.tag.name,
                    'tag_id': panel.tag_id,
                    'tag_name': panel.tag.name,
                    'unit': panel.tag.unit or '',
                    'scale_min': panel.scale_min,
                    'scale_max': panel.scale_max,
                    'value': round(float(val), 4) if val is not None else None,
                    'timestamp': latest.timestamp.isoformat() if latest else None,
                    'fill_ratio': round(float(ratio), 4) if ratio is not None else None,
                    'needle_degrees': round(float(needle), 2) if needle is not None else None,
                    'status_level': st_level,
                    'series': series_pts if panel.widget_type == 'trend' else [],
                }
            )

        return Response({'panels': out, 'refreshed_at': now.isoformat()})


class DashboardStatsView(generics.GenericAPIView):
    """
    Returns dashboard statistics for the logged-in user:
    - Current usage (latest tag log value)
    - Pending bill amount
    - Active tickets count
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get current usage - sum of latest values from all tags
        latest_usage = TagLog.objects.filter(
            tag__name__icontains='usage'
        ).order_by('-timestamp').first()
        current_usage = latest_usage.value if latest_usage else 0
        
        # Get pending bill amount
        pending_bills = Bill.objects.filter(user=user, is_paid=False)
        pending_amount = pending_bills.aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Get active tickets count
        active_tickets = Complaint.objects.filter(
            user=user
        ).exclude(status='resolved').count()
        
        return Response({
            "current_usage_kwh": round(current_usage, 2),
            "pending_bill_etb": float(pending_amount),
            "active_tickets": active_tickets
        })

class UsageAnalyticsView(generics.GenericAPIView):
    """
    Returns usage analytics data for charts.
    Supports time_range: 'week', 'month', 'year'
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        time_range = request.query_params.get('time_range', 'week')
        
        # Get usage tag (assuming there's a tag for energy usage)
        usage_tag = Tag.objects.filter(name__icontains='usage').first()
        
        if not usage_tag:
            # Return mock data if no usage tag exists
            return Response(self._get_mock_data(time_range))
        
        end_date = timezone.now()
        
        if time_range == 'week':
            start_date = end_date - timedelta(days=7)
            data = self._get_daily_data(usage_tag, start_date, end_date)
        elif time_range == 'month':
            start_date = end_date - timedelta(days=30)
            data = self._get_daily_data(usage_tag, start_date, end_date)
        elif time_range == 'year':
            start_date = end_date - timedelta(days=365)
            data = self._get_monthly_data(usage_tag, start_date, end_date)
        else:
            data = self._get_mock_data(time_range)
        
        return Response({
            "time_range": time_range,
            "data": data
        })
    
    def _get_daily_data(self, tag, start_date, end_date):
        """Aggregate data by day"""
        logs = TagLog.objects.filter(
            tag=tag,
            timestamp__gte=start_date,
            timestamp__lte=end_date
        ).order_by('timestamp')
        
        # Group by date
        daily_data = {}
        for log in logs:
            date_key = log.timestamp.strftime('%a')  # Mon, Tue, etc.
            if date_key not in daily_data:
                daily_data[date_key] = []
            daily_data[date_key].append(log.value)
        
        # Calculate average for each day
        result = []
        for day, values in daily_data.items():
            result.append({
                'name': day,
                'usage': round(sum(values) / len(values), 2)
            })
        
        return result if result else self._get_mock_data('week')
    
    def _get_monthly_data(self, tag, start_date, end_date):
        """Aggregate data by month"""
        logs = TagLog.objects.filter(
            tag=tag,
            timestamp__gte=start_date,
            timestamp__lte=end_date
        ).order_by('timestamp')
        
        # Group by month
        monthly_data = {}
        for log in logs:
            month_key = log.timestamp.strftime('%b')  # Jan, Feb, etc.
            if month_key not in monthly_data:
                monthly_data[month_key] = []
            monthly_data[month_key].append(log.value)
        
        # Calculate average for each month
        result = []
        for month, values in monthly_data.items():
            result.append({
                'name': month,
                'usage': round(sum(values) / len(values), 2)
            })
        
        return result if result else self._get_mock_data('year')
    
    def _get_mock_data(self, time_range):
        """Return mock data when no real data exists"""
        if time_range == 'week':
            return [
                {'name': 'Mon', 'usage': 40},
                {'name': 'Tue', 'usage': 30},
                {'name': 'Wed', 'usage': 65},
                {'name': 'Thu', 'usage': 45},
                {'name': 'Fri', 'usage': 90},
                {'name': 'Sat', 'usage': 55},
                {'name': 'Sun', 'usage': 35},
            ]
        elif time_range == 'month':
            return [
                {'name': f'Week {i}', 'usage': 200 + i * 50} 
                for i in range(1, 5)
            ]
        else:  # year
            return [
                {'name': calendar.month_abbr[i], 'usage': 800 + i * 100}
                for i in range(1, 13)
            ]

class CostAnalyticsView(generics.GenericAPIView):
    """
    Returns cost analytics data for cost charts.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        time_range = request.query_params.get('time_range', 'month')
        
        # Mock cost data based on usage
        if time_range == 'week':
            data = [
                {'name': 'Mon', 'cost': 120},
                {'name': 'Tue', 'cost': 90},
                {'name': 'Wed', 'cost': 195},
                {'name': 'Thu', 'cost': 135},
                {'name': 'Fri', 'cost': 270},
                {'name': 'Sat', 'cost': 165},
                {'name': 'Sun', 'cost': 105},
            ]
        elif time_range == 'month':
            data = [
                {'name': f'Week {i}', 'cost': 600 + i * 150}
                for i in range(1, 5)
            ]
        else:
            data = [
                {'name': calendar.month_abbr[i], 'cost': 2400 + i * 300}
                for i in range(1, 13)
            ]
        
        return Response({
            "time_range": time_range,
            "data": data
        })

class RecentActivityView(generics.GenericAPIView):
    """
    Returns recent activity for the user.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get recent bills
        recent_bills = Bill.objects.filter(
            user=user
        ).order_by('-billing_date')[:3]
        
        # Get recent complaints
        recent_complaints = Complaint.objects.filter(
            user=user
        ).order_by('-created_at')[:3]
        
        activities = []
        
        for bill in recent_bills:
            activities.append({
                'type': 'bill',
                'description': f"Bill generated: ETB {bill.amount}",
                'date': bill.billing_date.isoformat(),
                'status': 'Paid' if bill.is_paid else 'Pending'
            })
        
        for complaint in recent_complaints:
            activities.append({
                'type': 'complaint',
                'description': f"Ticket: {complaint.subject}",
                'date': complaint.created_at.isoformat(),
                'status': complaint.status.title()
            })
        
        # Sort by date
        activities.sort(key=lambda x: x['date'], reverse=True)
        
        return Response({
            "activities": activities[:5]
        })

# --- USER PROFILE & SETTINGS VIEWS ---

class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Get or Update the logged-in user's profile.
    Endpoint: /api/profile/
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

class ChangePasswordView(generics.UpdateAPIView):
    """
    Change the logged-in user's password.
    Endpoint: /api/profile/change-password/
    Accepts POST, PUT, and PATCH.
    """
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        if not user.check_password(serializer.data.get("old_password")):
            return Response({"old_password": ["Wrong password."]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.data.get("new_password"))
        user.save()
        return Response({"message": "Password updated successfully"}, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

class DeleteAccountView(generics.DestroyAPIView):
    """
    Permanently delete the logged-in user's account.
    Endpoint: /api/profile/delete/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_destroy(self, instance):
        instance.delete()



# TrendAnnotationListCreateView has been moved to operations_views.py

class HistoryQueryView(generics.GenericAPIView):
    """
    Query tag history with optional time range filtering and aggregation.
    Parameters: tag_id, start_time, end_time, aggregation (none|hourly|daily)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tag_id = request.query_params.get('tag_id')
        start_time_str = request.query_params.get('start_time')
        end_time_str = request.query_params.get('end_time')
        aggregation = request.query_params.get('aggregation', 'none')

        if not tag_id:
            return Response({'error': 'tag_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)

        qs = TagLog.objects.filter(tag=tag).order_by('timestamp')

        if start_time_str:
            qs = qs.filter(timestamp__gte=datetime.fromisoformat(start_time_str))
        if end_time_str:
            qs = qs.filter(timestamp__lte=datetime.fromisoformat(end_time_str))

        logs = list(qs.values('timestamp', 'value'))

        return Response({
            'tag': TagSerializer(tag).data,
            'data': logs,
            'count': len(logs),
        })


class HistoryExportCsvView(generics.GenericAPIView):
    """
    Export tag history to CSV.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tag_id = request.query_params.get('tag_id')
        start_time_str = request.query_params.get('start_time')
        end_time_str = request.query_params.get('end_time')

        if not tag_id:
            return Response({'error': 'tag_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)

        qs = TagLog.objects.filter(tag=tag).order_by('timestamp')

        if start_time_str:
            qs = qs.filter(timestamp__gte=datetime.fromisoformat(start_time_str))
        if end_time_str:
            qs = qs.filter(timestamp__lte=datetime.fromisoformat(end_time_str))

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Value', 'Unit'])

        for log in qs:
            writer.writerow([
                log.timestamp.isoformat(),
                log.value,
                tag.unit or '',
            ])

        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="tag-{tag_id}-export.csv"'
        return response


# --- PLANT OPERATIONS ---

class PlantOverviewView(generics.GenericAPIView):
    """
    Get plant overview data: areas, equipment, their latest tag values, and alarm counts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        areas = PlantArea.objects.prefetch_related('equipment').order_by('sort_order')

        result = []
        for area in areas:
            equipment_data = []
            for eq in area.equipment.all():
                # Get latest tag value if primary_tag is set
                latest_value = None
                if eq.primary_tag:
                    latest_log = TagLog.objects.filter(tag=eq.primary_tag).order_by('-timestamp').first()
                    if latest_log:
                        latest_value = latest_log.value

                # Count active alarms for this equipment (if linked via tag)
                alarm_count = 0
                if eq.primary_tag:
                    alarm_count = AlarmEvent.objects.filter(
                        rule__tag=eq.primary_tag,
                        state__in=['active', 'acknowledged']
                    ).count()

                equipment_data.append({
                    'id': eq.id,
                    'code': eq.code,
                    'name': eq.name,
                    'primary_tag_id': eq.primary_tag_id,
                    'primary_tag_name': eq.primary_tag.name if eq.primary_tag else None,
                    'current_value': latest_value,
                    'map_rect': eq.map_rect,
                    'alarm_count': alarm_count,
                })

            result.append({
                'id': area.id,
                'code': area.code,
                'name': area.name,
                'layout': area.layout,
                'equipment': equipment_data,
            })

        return Response({'areas': result})


class OperatorJournalListCreateView(generics.ListCreateAPIView):
    """
    Get/create operator journal entries (shift logs).
    """
    serializer_class = OperatorJournalEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = OperatorJournalEntry.objects.select_related(
            'author', 'related_alarm_event', 'related_tag'
        ).order_by('-occurred_at')

        # Optional filtering by time range
        start_time_str = self.request.query_params.get('start_time')
        end_time_str = self.request.query_params.get('end_time')

        if start_time_str:
            qs = qs.filter(occurred_at__gte=datetime.fromisoformat(start_time_str))
        if end_time_str:
            qs = qs.filter(occurred_at__lte=datetime.fromisoformat(end_time_str))

        # Operators see all, customers see none (or could limit to their complaints)
        if self.request.user.role == User.CUSTOMER:
            # Customers don't see the journal (or could see only entries related to their complaints)
            qs = qs.none()

        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class EvaluateComplaintSlaView(generics.GenericAPIView):
    """
    Evaluate complaint SLAs and generate notifications for breaches.
    (Could be called by a scheduled task or manually by admin)
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role != User.ADMIN:
            return Response({'error': 'Only admins can run SLA evaluation'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        
        # SLA: 24 hours for initial response (Medium priority)
        # SLA: 4 hours for initial response (High priority)

        complaints = Complaint.objects.filter(status__in=['pending', 'investigating'])
        breached = []

        for complaint in complaints:
            sla_hours = 4 if complaint.priority == 'high' else 24
            sla_deadline = complaint.created_at + timedelta(hours=sla_hours)

            if now > sla_deadline and not complaint.sla_notification_sent_at:
                # Create in-app notification
                InAppNotification.objects.create(
                    user=complaint.user,
                    category=InAppNotification.CATEGORY_COMPLAINT_SLA,
                    title=f"SLA Breach: {complaint.subject}",
                    body=f"Support ticket #{complaint.id} has exceeded its SLA.",
                    payload={'complaint_id': complaint.id}
                )

                complaint.sla_notification_sent_at = now
                complaint.save(update_fields=['sla_notification_sent_at'])

                breached.append(complaint.id)

        return Response({
            'breached_count': len(breached),
            'complaint_ids': breached
        })


# --- NOTIFICATIONS ---

class InAppNotificationListView(generics.ListAPIView):
    """
    Get user's in-app notifications, optionally filtered by read status.
    """
    serializer_class = InAppNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = InAppNotification.objects.filter(user=self.request.user).order_by('-created_at')

        is_read = self.request.query_params.get('is_read')
        if is_read == 'true':
            qs = qs.filter(read_at__isnull=False)
        elif is_read == 'false':
            qs = qs.filter(read_at__isnull=True)

        return qs


class InAppNotificationMarkReadView(generics.GenericAPIView):
    """
    Mark a single in-app notification as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = InAppNotification.objects.get(id=pk, user=request.user)
        except InAppNotification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)

        notif.read_at = timezone.now()
        notif.save(update_fields=['read_at'])

        return Response({'status': 'marked as read'})


class InAppNotificationMarkAllReadView(generics.GenericAPIView):
    """
    Mark all user notifications as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        count = InAppNotification.objects.filter(
            user=request.user,
            read_at__isnull=True
        ).update(read_at=timezone.now())

        return Response({'marked_as_read': count})


class NotificationSubscriptionListCreateView(generics.ListCreateAPIView):
    """
    List/create notification subscriptions (email, SMS, webhook).
    """
    serializer_class = NotificationSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NotificationSubscription.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationSubscriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Get/update/delete a single notification subscription.
    """
    serializer_class = NotificationSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NotificationSubscription.objects.filter(user=self.request.user)


# ---------------------------------------------------------------------------
# AUDIT LOGGING
# ---------------------------------------------------------------------------

def log_operator_action(user, action_type, description, target_tag=None, old_value='', new_value='', ip_address=None):
    """Helper to persist an operator action audit record."""
    try:
        OperatorActionLog.objects.create(
            user=user,
            action_type=action_type,
            target_tag=target_tag,
            description=description,
            old_value=str(old_value)[:100],
            new_value=str(new_value)[:100],
            ip_address=ip_address,
        )
    except Exception:
        import logging
        logging.getLogger(__name__).exception('Failed to write operator action log')


class OperatorActionLogListView(generics.ListAPIView):
    """Return paginated operator action audit log."""
    serializer_class = OperatorActionLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = OperatorActionLog.objects.select_related('user', 'target_tag').order_by('-created_at')
        action_type = self.request.query_params.get('action_type')
        if action_type:
            qs = qs.filter(action_type=action_type)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        since = self.request.query_params.get('since')
        if since:
            qs = qs.filter(created_at__gte=since)
        return qs[:500]


# ---------------------------------------------------------------------------
# AI INTELLIGENCE VIEWS
# ---------------------------------------------------------------------------

class AIAnomalyDashboardView(generics.GenericAPIView):
    """Aggregated anomaly metrics for the AI insights dashboard."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        last_7d = now - timedelta(days=7)

        recent_findings = AIFinding.objects.filter(finding_type='anomaly', created_at__gte=last_24h)
        week_findings = AIFinding.objects.filter(finding_type='anomaly', created_at__gte=last_7d)

        # Confidence distribution
        confidences = [f.result_json.get('confidence', 0) for f in recent_findings if isinstance(f.result_json, dict)]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        # Top anomalous tags
        tag_counts = defaultdict(int)
        for f in week_findings:
            if f.tag_id:
                tag_counts[f.tag_id] += 1
        top_tags = sorted(tag_counts.items(), key=lambda x: -x[1])[:5]
        top_tag_ids = [t[0] for t in top_tags]
        tag_names = {t.id: t.name for t in Tag.objects.filter(id__in=top_tag_ids)}

        # Recent AIAnalysis records
        recent_analyses = AIAnalysis.objects.select_related('tag').order_by('-detected_at')[:20]
        anomalies = [
            {
                'id': a.id,
                'tag_name': a.tag.name if a.tag else None,
                'is_anomaly': a.is_anomaly,
                'confidence': a.confidence_score,
                'explanation': a.explanation,
                'detected_at': a.detected_at.isoformat(),
            }
            for a in recent_analyses
        ]

        return Response({
            'recent_anomalies_24h': recent_findings.count(),
            'total_anomalies_7d': week_findings.count(),
            'avg_confidence': round(avg_confidence, 3),
            'top_anomalous_tags': [
                {'tag_id': tid, 'tag_name': tag_names.get(tid, f'Tag {tid}'), 'count': cnt}
                for tid, cnt in top_tags
            ],
            'recent_detections': anomalies,
        })


class AIPredictiveMaintenanceView(generics.GenericAPIView):
    """Predict equipment maintenance needs based on tag trends."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        equipment_list = PlantEquipment.objects.select_related('area').all()[:50]
        predictions = []
        for eq in equipment_list:
            tid = eq.primary_tag_id
            if not tid:
                continue
            recent_logs = TagLog.objects.filter(tag_id=tid).order_by('-timestamp')[:100]
            if not recent_logs:
                continue
            values = [float(log.value) for log in recent_logs]
            avg_val = sum(values) / len(values)
            variance = sum((v - avg_val) ** 2 for v in values) / len(values) if values else 0
            # Simple heuristic: high variance = degrading
            health = 'good' if variance < 10 else 'degrading' if variance < 50 else 'critical'
            predictions.append({
                'equipment_id': eq.id,
                'equipment_name': eq.name,
                'area': eq.area.name if eq.area else None,
                'avg_value': round(avg_val, 2),
                'variance': round(variance, 2),
                'health': health,
                'samples': len(values),
                'recommendation': 'Schedule inspection' if health != 'good' else 'No action needed',
            })
        predictions.sort(key=lambda x: {'critical': 0, 'degrading': 1, 'good': 2}.get(x['health'], 3))
        return Response({'predictions': predictions})


class AIAlarmPrioritizationView(generics.GenericAPIView):
    """AI-ranked list of active alarms by risk."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        open_states = ['active', 'acknowledged', 'shelved']
        active_events = AlarmEvent.objects.filter(state__in=open_states).select_related('rule', 'rule__tag').order_by('-triggered_at')

        severity_weight = {'critical': 100, 'high': 60, 'medium': 30, 'low': 10}
        ranked = []
        now = timezone.now()
        for evt in active_events[:100]:
            sev_score = severity_weight.get(evt.rule.severity, 10)
            # Duration factor: longer open = higher risk
            duration_mins = (now - evt.triggered_at).total_seconds() / 60 if evt.triggered_at else 0
            duration_score = min(duration_mins / 60, 5) * 10  # max 50 pts for 5+ hours
            # Level factor
            level_score = 30 if evt.level == 'alarm' else 10
            priority_score = sev_score + duration_score + level_score
            ranked.append({
                'event_id': evt.id,
                'rule_name': evt.rule.name,
                'tag_name': evt.rule.tag.name if evt.rule.tag else None,
                'severity': evt.rule.severity,
                'level': evt.level,
                'state': evt.state,
                'triggered_value': evt.triggered_value,
                'message': evt.message,
                'triggered_at': evt.triggered_at.isoformat() if evt.triggered_at else None,
                'duration_minutes': round(duration_mins, 1),
                'priority_score': round(priority_score, 1),
            })
        ranked.sort(key=lambda x: -x['priority_score'])
        return Response({'ranked_alarms': ranked})


class AIRootCauseView(generics.GenericAPIView):
    """Suggest root cause for a given alarm event by analyzing correlated tag movements."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        event_id = request.data.get('event_id')
        if not event_id:
            return Response({'error': 'event_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            event = AlarmEvent.objects.select_related('rule', 'rule__tag').get(id=event_id)
        except AlarmEvent.DoesNotExist:
            return Response({'error': 'Alarm event not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get the alarm tag's recent data
        alarm_tag_id = event.rule.tag_id
        trigger_time = event.triggered_at or timezone.now()
        window_start = trigger_time - timedelta(minutes=30)

        alarm_logs = TagLog.objects.filter(tag_id=alarm_tag_id, timestamp__gte=window_start).order_by('timestamp')[:100]
        alarm_values = [float(l.value) for l in alarm_logs]

        # Check correlated tags for simultaneous deviations
        all_tags = Tag.objects.exclude(id=alarm_tag_id)[:20]
        correlations = []
        for tag in all_tags:
            tag_logs = TagLog.objects.filter(tag_id=tag.id, timestamp__gte=window_start).order_by('timestamp')[:100]
            if len(tag_logs) < 5:
                continue
            tag_values = [float(l.value) for l in tag_logs]
            tag_avg = sum(tag_values) / len(tag_values)
            tag_var = sum((v - tag_avg) ** 2 for v in tag_values) / len(tag_values)
            if tag_var > 5:  # Significant variation
                correlations.append({
                    'tag_id': tag.id,
                    'tag_name': tag.name,
                    'variance': round(tag_var, 2),
                    'avg_value': round(tag_avg, 2),
                })

        correlations.sort(key=lambda x: -x['variance'])

        # Build suggestion
        suggestion_parts = [f"Alarm on {event.rule.tag.name}: {event.message}"]
        if correlations:
            corr_names = ', '.join(c['tag_name'] for c in correlations[:3])
            suggestion_parts.append(f"Correlated deviations detected in: {corr_names}")
            suggestion_parts.append("Possible root cause: upstream process disturbance affecting multiple sensors.")
        else:
            suggestion_parts.append("No correlated tag deviations found. Likely isolated sensor or threshold issue.")

        # Log finding
        AIFinding.objects.create(
            finding_type='root_cause',
            tag_id=alarm_tag_id,
            alarm_event=event,
            result_json={
                'suggestion': ' '.join(suggestion_parts),
                'correlations': correlations[:5],
                'alarm_values_sample': alarm_values[:10],
            },
        )

        return Response({
            'event_id': event.id,
            'suggestion': ' '.join(suggestion_parts),
            'correlated_tags': correlations[:5],
        })


class AITrendAbnormalityView(generics.GenericAPIView):
    """Analyze a tag's recent trend for statistical abnormalities."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tag_id = request.data.get('tag_id')
        if not tag_id:
            return Response({'error': 'tag_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)

        recent_logs = TagLog.objects.filter(tag_id=tag_id).order_by('-timestamp')[:200]
        if len(recent_logs) < 10:
            return Response({'error': 'Insufficient data for analysis (need at least 10 samples)'}, status=status.HTTP_400_BAD_REQUEST)

        values = [float(l.value) for l in recent_logs]
        values.reverse()  # chronological order
        avg = sum(values) / len(values)
        std_dev = (sum((v - avg) ** 2 for v in values) / len(values)) ** 0.5

        # Z-score based abnormality detection
        abnormal_points = []
        for i, v in enumerate(values):
            z = abs(v - avg) / std_dev if std_dev > 0 else 0
            if z > 2.0:
                abnormal_points.append({
                    'index': i,
                    'value': v,
                    'z_score': round(z, 2),
                    'timestamp': recent_logs[len(recent_logs) - 1 - i].timestamp.isoformat(),
                })

        # Rate of change analysis
        rates = [abs(values[i+1] - values[i]) for i in range(len(values)-1)]
        avg_rate = sum(rates) / len(rates) if rates else 0
        max_rate = max(rates) if rates else 0

        # Trend direction
        half = len(values) // 2
        first_half_avg = sum(values[:half]) / half if half > 0 else avg
        second_half_avg = sum(values[half:]) / (len(values) - half) if (len(values) - half) > 0 else avg
        trend = 'rising' if second_half_avg > first_half_avg * 1.02 else 'falling' if second_half_avg < first_half_avg * 0.98 else 'stable'

        abnormality_score = min(1.0, len(abnormal_points) / max(len(values) * 0.1, 1))

        result = {
            'tag_id': tag.id,
            'tag_name': tag.name,
            'samples': len(values),
            'mean': round(avg, 2),
            'std_dev': round(std_dev, 2),
            'trend': trend,
            'avg_rate_of_change': round(avg_rate, 3),
            'max_rate_of_change': round(max_rate, 3),
            'abnormal_points': abnormal_points[:20],
            'abnormal_point_count': len(abnormal_points),
            'abnormality_score': round(abnormality_score, 3),
            'is_abnormal': abnormality_score > 0.3,
            'confidence': round(1.0 - abnormality_score, 3) if abnormality_score <= 0.3 else round(abnormality_score, 3),
            'explanation': f"Found {len(abnormal_points)} abnormal data points (z-score > 2.0) out of {len(values)} samples. Trend is {trend}.",
        }

        # Log finding
        AIFinding.objects.create(
            finding_type='trend_abnormality',
            tag=tag,
            result_json=result,
        )

        return Response(result)


class AIFindingListView(generics.ListAPIView):
    """List AI findings with optional filtering."""
    serializer_class = AIFindingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AIFinding.objects.select_related('tag', 'alarm_event').order_by('-created_at')
        finding_type = self.request.query_params.get('finding_type')
        if finding_type:
            qs = qs.filter(finding_type=finding_type)
        tag_id = self.request.query_params.get('tag_id')
        if tag_id:
            qs = qs.filter(tag_id=tag_id)
        return qs[:200]


class AIEquipmentHealthView(generics.GenericAPIView):
    """Equipment health summary from AI predictive maintenance analysis."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        equipment_list = PlantEquipment.objects.select_related('area').all()[:50]
        health_items = []
        
        for eq in equipment_list:
            tid = eq.primary_tag_id
            if not tid:
                continue
            recent_logs = TagLog.objects.filter(tag_id=tid).order_by('-timestamp')[:200]
            if len(recent_logs) < 10:
                continue
            
            values = [float(log.value) for log in recent_logs]
            avg_val = sum(values) / len(values)
            std_dev = (sum((v - avg_val) ** 2 for v in values) / len(values)) ** 0.5
            variance = std_dev ** 2
            
            # Compute health score (0-1) based on multiple factors
            health_score = 1.0
            issues = []
            recommendations = []
            
            # Factor 1: Variance (high = bad)
            cv = std_dev / max(abs(avg_val), 1e-9)
            if cv > 0.3:
                health_score -= 0.3
                issues.append(f'High coefficient of variation ({cv:.2f}) - sensor may need calibration')
                recommendations.append('Schedule sensor calibration')
            elif cv > 0.15:
                health_score -= 0.15
                issues.append(f'Moderate variance detected (CV: {cv:.2f})')
            
            # Factor 2: Trend analysis
            half = len(values) // 2
            first_half_avg = sum(values[:half]) / half if half > 0 else avg_val
            second_half_avg = sum(values[half:]) / (len(values) - half) if (len(values) - half) > 0 else avg_val
            drift_pct = abs(second_half_avg - first_half_avg) / max(abs(first_half_avg), 1e-9) * 100
            
            if drift_pct > 20:
                health_score -= 0.25
                trend_dir = 'rising' if second_half_avg > first_half_avg else 'falling'
                issues.append(f'Significant trend drift ({drift_pct:.1f}% {trend_dir})')
                recommendations.append('Investigate process changes or equipment wear')
            elif drift_pct > 10:
                health_score -= 0.1
            
            # Factor 3: Outlier detection
            outlier_count = sum(1 for v in values if abs(v - avg_val) > 2.5 * std_dev)
            if outlier_count > len(values) * 0.05:
                health_score -= 0.2
                issues.append(f'{outlier_count} statistical outliers in recent data')
                recommendations.append('Check for intermittent faults or sensor noise')
            
            health_score = max(0.0, min(1.0, health_score))
            
            if health_score >= 0.8:
                eq_status = 'healthy'
            elif health_score >= 0.6:
                eq_status = 'degrading'
            elif health_score >= 0.4:
                eq_status = 'warning'
            else:
                eq_status = 'critical'
            
            health_items.append({
                'equipment_type': eq.name.lower().replace(' ', '_'),
                'equipment_id': f'{eq.name.lower().replace(" ", "_")}_primary',
                'health_score': round(health_score, 2),
                'status': eq_status,
                'issues': issues,
                'recommendations': recommendations,
                'metrics': {
                    'mean': round(avg_val, 2),
                    'std_dev': round(std_dev, 2),
                    'variance': round(variance, 2),
                    'cv': round(cv, 3),
                    'samples': len(values),
                    'drift_pct': round(drift_pct, 1),
                },
                'timestamp': time.time(),
            })
        
        health_items.sort(key=lambda x: x['health_score'])
        return Response(health_items)


class AIMaintenanceAlertsView(generics.GenericAPIView):
    """Active maintenance alerts from AI analysis."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Generate alerts from recent AI findings of type 'prediction'
        recent_findings = AIFinding.objects.filter(
            finding_type='prediction',
            created_at__gte=timezone.now() - timedelta(hours=24)
        ).select_related('tag').order_by('-created_at')[:20]
        
        alerts = []
        for finding in recent_findings:
            result = finding.result_json or {}
            health_score = result.get('health_score', result.get('health', 100))
            if isinstance(health_score, str):
                health_score = {'good': 80, 'degrading': 50, 'critical': 20}.get(health_score, 50)
            
            if health_score < 70:
                severity = 'critical' if health_score < 40 else 'warning'
                alerts.append({
                    'alert_type': result.get('alert_type', 'degradation'),
                    'severity': severity,
                    'equipment_type': finding.tag.name if finding.tag else 'unknown',
                    'equipment_id': f'{finding.tag.name if finding.tag else "unknown"}_primary',
                    'message': result.get('prediction', result.get('suggestion', 'Equipment degradation detected')),
                    'confidence': result.get('confidence', 0.7),
                    'recommended_action': result.get('recommended_action', result.get('recommendation', 'Schedule inspection')),
                    'estimated_days_to_failure': result.get('estimated_days_to_failure'),
                    'timestamp': finding.created_at.timestamp(),
                })
        
        return Response(alerts)


class AIEnergyAdvisoryView(generics.GenericAPIView):
    """Calculate and return energy optimization recommendations and metrics dynamically."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        import time
        from django.utils import timezone
        from .models import Tag, TagLog

        # 1. Fetch tags
        flow_tag = Tag.objects.filter(name__icontains='flow').first()
        press_tag = Tag.objects.filter(name__icontains='pressure').first()
        pump_tag = Tag.objects.filter(name__icontains='pump').first()

        # 2. Fetch recent logs (last 100)
        logs_limit = 100
        flow_logs = TagLog.objects.filter(tag=flow_tag).order_by('-timestamp')[:logs_limit] if flow_tag else []
        press_logs = TagLog.objects.filter(tag=press_tag).order_by('-timestamp')[:logs_limit] if press_tag else []
        pump_logs = TagLog.objects.filter(tag=pump_tag).order_by('-timestamp')[:logs_limit] if pump_tag else []

        flows = [float(l.value) for l in flow_logs]
        pressures = [float(l.value) for l in press_logs]
        
        # Latest values
        flow = flows[0] if flows else 0.0
        pressure = pressures[0] if pressures else 0.0
        pump_on = (pump_logs[0].value > 0) if pump_logs else (flow > 10.0) # default true if flow > 10 L/min

        # Power estimation
        base_power = 7.5  # kW main pump rating
        if not pump_on:
            power = 0.5  # standby
        else:
            flow_ratio = flow / 230.0
            power_factor = min(1.5, flow_ratio ** 1.5) if flow_ratio > 0 else 0.1
            pressure_ratio = pressure / 3.5
            pressure_penalty = 1.0 + abs(pressure_ratio - 1.0) * 0.2
            power = base_power * power_factor * pressure_penalty

        # Compute specific energy (kWh per m3 pumped)
        flow_m3_h = flow * 0.06
        specific_energy = power / flow_m3_h if flow_m3_h > 0 else 0.0

        # Consumption estimation
        avg_power = sum(
            [7.5 * min(1.5, (f/230.0)**1.5) * (1.0 + abs((p/3.5)-1.0)*0.2) if f > 10.0 else 0.5 
             for f, p in zip(flows[:20], pressures[:20])]
        ) / max(len(flows[:20]), 1) if flows else 0.5
        
        daily_kwh = avg_power * 24.0
        monthly_kwh = daily_kwh * 30.0
        peak_demand_kw = max([power * 1.2 if pump_on else 0.5])

        # Power factor
        apparent_power = max(power, 0.1) * 1.1
        power_factor = min(0.98, power / apparent_power)

        # Efficiency rating
        if flows:
            avg_flow = sum(flows) / len(flows)
            flow_efficiency = 1.0 - abs(avg_flow - 230.0) / 230.0
            overall_efficiency = (power_factor + flow_efficiency) / 2
        else:
            overall_efficiency = power_factor

        if overall_efficiency >= 0.85:
            rating = 'A'
        elif overall_efficiency >= 0.75:
            rating = 'B'
        elif overall_efficiency >= 0.65:
            rating = 'C'
        elif overall_efficiency >= 0.55:
            rating = 'D'
        else:
            rating = 'F'

        # Cost per cubic meter ( Ethiopian pricing: mid_peak = 1.80 ETB / kWh )
        mid_peak_price = 1.80
        monthly_cost = monthly_kwh * mid_peak_price
        avg_flow_val = sum(flows) / len(flows) if flows else 1.0
        monthly_volume_m3 = avg_flow_val * 0.06 * 24.0 * 30.0
        cost_per_m3 = monthly_cost / max(monthly_volume_m3, 0.1)

        # Recommendations
        recommendations = []
        
        # 1. Scheduling
        current_hour = timezone.now().hour
        if 18 <= current_hour <= 22 and pump_on:
            shift_amount = 7.5 * 2.0  # kwh
            savings = shift_amount * (2.50 - 0.95)  # peak - off_peak diff
            recommendations.append({
                'category': 'scheduling',
                'priority': 'high',
                'title': 'Peak Hour Load Shifting Opportunity',
                'description': 'The pump is currently operating during peak electricity tariff hours (18:00 - 22:00). Consider shifting non-critical pumping tasks to off-peak hours (22:00 - 08:00) to reduce peak demand charges.',
                'estimated_savings_pct': 15.0,
                'estimated_savings_etb': round(savings * 30, 2),
                'implementation_effort': 'easy',
                'metrics': {'current_hour': current_hour, 'pricing_diff': 1.55},
                'timestamp': time.time(),
            })

        # 2. Efficiency
        if flow > 0:
            flow_dev = abs(flow - 230.0) / 230.0 * 100
            press_dev = abs(pressure - 3.5) / 3.5 * 100
            
            recs_text = []
            if flow_dev > 25:
                recs_text.append(f"Pump operating point deviates significantly ({flow_dev:.1f}%) from its optimal flow rate of 230 L/min.")
            if pressure > 4.2 and flow < 180:
                recs_text.append("High system pressure paired with low flow suggests throttling. Installing a Variable Speed Drive (VSD) would prevent energy bypass loss.")
                
            if recs_text:
                efficiency_loss_pct = min(35.0, flow_dev * 0.5 + press_dev * 0.5)
                savings_eff = monthly_cost * (efficiency_loss_pct / 100)
                recommendations.append({
                    'category': 'efficiency',
                    'priority': 'medium' if efficiency_loss_pct < 20 else 'high',
                    'title': 'Variable Speed Drive (VSD) Optimization',
                    'description': ' '.join(recs_text),
                    'estimated_savings_pct': round(efficiency_loss_pct, 1),
                    'estimated_savings_etb': round(savings_eff, 2),
                    'implementation_effort': 'medium',
                    'metrics': {'flow_deviation_pct': flow_dev, 'pressure_deviation_pct': press_dev},
                    'timestamp': time.time(),
                })
        
        # 3. Demand Charge
        if pump_on and flow > 300:
            recommendations.append({
                'category': 'demand',
                'priority': 'medium',
                'title': 'Soft-Starter Installation',
                'description': 'Frequent high-current start spikes increase capacity demand charges. Installing a soft-starter can smooth out start current peaks and prolong motor life.',
                'estimated_savings_pct': 5.0,
                'estimated_savings_etb': 250.00,
                'implementation_effort': 'easy',
                'metrics': {},
                'timestamp': time.time(),
            })

        # Fallback default recommendation if list is empty
        if not recommendations:
            recommendations.append({
                'category': 'scheduling',
                'priority': 'low',
                'title': 'Routine Scheduling Audit',
                'description': 'Pump scheduling is currently optimal. Maintain current runtime settings and perform regular scheduling reviews quarterly.',
                'estimated_savings_pct': 0.0,
                'estimated_savings_etb': 0.0,
                'implementation_effort': 'easy',
                'metrics': {},
                'timestamp': time.time(),
            })

        # Estimated savings
        est_savings = sum(r['estimated_savings_etb'] for r in recommendations)

        return Response({
            'type': 'energy_advisory',
            'source': 'energy_optimizer',
            'metrics': {
                'current_power_kw': round(power, 2),
                'daily_consumption_kwh': round(daily_kwh, 2),
                'monthly_consumption_kwh': round(monthly_kwh, 2),
                'peak_demand_kw': round(peak_demand_kw, 2),
                'power_factor': round(power_factor, 3),
                'efficiency_rating': rating,
                'cost_per_cubic_meter': round(cost_per_m3, 2),
                'specific_energy_kwh_per_m3': round(specific_energy, 3),
                'timestamp': time.time(),
            },
            'recommendations': recommendations,
            'total_recommendations': len(recommendations),
            'estimated_monthly_savings_etb': round(est_savings, 2),
            'timestamp': time.time(),
        })


# --- Real-time SSE Endpoint ---

class RealtimeStreamView(APIView):
    """
    Server-Sent Events endpoint for real-time data.
    Clients can subscribe to: tags, alarms, ai, system, all
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .realtime_service import sse_bus, generate_sse_stream
        
        channels_param = request.GET.get('channels', 'all')
        channels = [c.strip() for c in channels_param.split(',')]
        
        client_id, event_queue = sse_bus.subscribe(channels)
        
        response = StreamingHttpResponse(
            generate_sse_stream(client_id, event_queue, channels),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


# --- Comprehensive Audit Trail ---

class AuditTrailView(generics.GenericAPIView):
    """Query and retrieve audit trail records."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .audit_service import audit_trail
        
        category = request.GET.get('category')
        action = request.GET.get('action')
        user = request.GET.get('user')
        severity = request.GET.get('severity')
        limit = int(request.GET.get('limit', 100))
        
        records = audit_trail.query(
            category=category,
            action=action,
            user=user,
            severity=severity,
            limit=limit,
        )
        
        return Response({
            'count': len(records),
            'records': records,
        })


class AuditTrailStatsView(generics.GenericAPIView):
    """Audit trail statistics."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .audit_service import audit_trail
        
        hours = int(request.GET.get('hours', 24))
        stats = audit_trail.get_statistics(hours=hours)
        return Response(stats)


class AuditTrailExportView(generics.GenericAPIView):
    """Export audit trail as CSV."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .audit_service import audit_trail
        
        category = request.GET.get('category')
        csv_content = audit_trail.export_csv(category=category)
        
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="audit_trail_{category or "all"}.csv"'
        return response


# --- Report Generation ---

class ReportDailySummaryView(generics.GenericAPIView):
    """Generate daily summary report."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .report_service import report_generator
        
        date = request.GET.get('date')
        report = report_generator.generate_daily_summary(date)
        
        format_type = request.GET.get('format', 'json')
        if format_type == 'csv':
            csv_content = report_generator.export_to_csv(report)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="daily_summary_{date or "today"}.csv"'
            return response
        
        return Response(report)


class ReportAlarmAnalysisView(generics.GenericAPIView):
    """Generate alarm analysis report."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .report_service import report_generator
        
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        report = report_generator.generate_alarm_report(start_date, end_date)
        
        format_type = request.GET.get('format', 'json')
        if format_type == 'csv':
            csv_content = report_generator.export_to_csv(report)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="alarm_report.csv"'
            return response
        
        return Response(report)


class ReportEquipmentHealthView(generics.GenericAPIView):
    """Generate equipment health report."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .report_service import report_generator
        
        report = report_generator.generate_equipment_health_report()
        
        format_type = request.GET.get('format', 'json')
        if format_type == 'csv':
            csv_content = report_generator.export_to_csv(report)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="equipment_health.csv"'
            return response
        
        return Response(report)


class ReportPerformanceView(generics.GenericAPIView):
    """Generate performance/production report."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .report_service import report_generator
        
        start_date = request.GET.get('start_date')
        end_date = request.GET.get('end_date')
        report = report_generator.generate_performance_report(start_date, end_date)
        
        format_type = request.GET.get('format', 'json')
        if format_type == 'csv':
            csv_content = report_generator.export_to_csv(report)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="performance_report.csv"'
            return response
        
        return Response(report)

