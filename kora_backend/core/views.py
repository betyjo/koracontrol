from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from collections import defaultdict

from .dashboard_viz import gauge_needle_degrees, normalized_ratio, status_level_for_value
from .alarm_evaluator import evaluate_alarm_for_log
from .models import User, Tag, TagLog, DashboardVisualization, AlarmRule, AlarmEvent, TrendAnnotation, OperatorJournalEntry, InAppNotification, NotificationSubscription, PlantArea, PlantEquipment, Bill, PaymentTransaction, Complaint, AIAnalysis, ChatThread, ChatMessage, ChatAttachment
from .serializers import (
    RegisterSerializer,
    MyTokenObtainPairSerializer,
    TagSerializer, TagLogSerializer, UserSerializer, ChangePasswordSerializer,
    ForgotPasswordRequestSerializer, ResetPasswordSerializer,
    AlarmRuleSerializer, AlarmEventSerializer, AlarmAcknowledgeSerializer, AlarmShelveSerializer,
    TrendAnnotationSerializer, OperatorJournalEntrySerializer,
    InAppNotificationSerializer, NotificationSubscriptionSerializer, PlantEquipmentSerializer
)
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from datetime import timedelta, datetime
import calendar
import csv
import io
import json
import mimetypes
from django.http import StreamingHttpResponse, HttpResponse

# --- AUTH VIEWS ---

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

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

class TagLogListCreateView(generics.ListCreateAPIView):
    """
    Team 1 uses this to send actual PLC values.
    Endpoint: /api/logs/
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = TagLog.objects.all().order_by('-timestamp')
    serializer_class = TagLogSerializer

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
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ComplaintSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'operator']:
            return Complaint.objects.all() # Staff sees everything
        return Complaint.objects.filter(user=user) # Customers see only theirs

    def perform_create(self, serializer):
        # Automatically assign the complaint to the logged-in user
        serializer.save(user=self.request.user)

class ComplaintDetailView(generics.RetrieveUpdateAPIView):
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
        qs = self.queryset
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
        if request.user.role not in ['admin', 'operator']:
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
        return Response(AlarmEventSerializer(event).data)


class AlarmShelveView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AlarmShelveSerializer

    def post(self, request, event_id):
        if request.user.role not in ['admin', 'operator']:
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
        return Response(AlarmEventSerializer(event).data)


class AlarmUnshelveView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, event_id):
        if request.user.role not in ['admin', 'operator']:
            return Response({"detail": "Only admins/operators can unshelve alarms."}, status=403)

        event = get_object_or_404(AlarmEvent, id=event_id)
        if event.state != 'shelved':
            return Response({"detail": "Event is not shelved."}, status=400)

        next_state = 'acknowledged' if event.acknowledged_at else 'active'
        event.state = next_state
        event.shelved_until = None
        event.save(update_fields=['state', 'shelved_until'])
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


# --- TREND & ANNOTATIONS ---

class TrendAnnotationListCreateView(generics.ListCreateAPIView):
    """
    Get/create trend annotations (incident markers) on tag data.
    """
    serializer_class = TrendAnnotationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tag_id = self.request.query_params.get('tag_id')
        qs = TrendAnnotation.objects.select_related('created_by')
        if tag_id:
            qs = qs.filter(tag_id=tag_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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

