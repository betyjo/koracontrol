from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Tag, TagLog
from .serializers import (
    RegisterSerializer, MyTokenObtainPairSerializer, 
    TagSerializer, TagLogSerializer, UserSerializer, ChangePasswordSerializer,
    ForgotPasswordRequestSerializer, ResetPasswordSerializer
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
    queryset = TagLog.objects.all().order_by('-timestamp')
    serializer_class = TagLogSerializer

    def create(self, request, *args, **kwargs):
        # We allow bulk logging or single logging
        return super().create(request, *args, **kwargs)

from django.shortcuts import get_object_or_404
from .models import Bill, PaymentTransaction, Complaint
from .chapa_service import initialize_chapa_payment
from .serializers import BillSerializer, ComplaintSerializer, ComplaintUpdateSerializer
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
        
        # 1. Create a transaction record
        transaction = PaymentTransaction.objects.create(
            user=request.user,
            bill=bill,
            amount=bill.amount
        )

        # 2. Call Chapa
        chapa_res = initialize_chapa_payment(transaction)

        if chapa_res.get('status') == 'success':
            return Response({
                "checkout_url": chapa_res['data']['checkout_url'],
                "tx_ref": transaction.tx_ref
            })
        else:
            return Response({"error": "Chapa initialization failed"}, status=400)

class PaymentCallbackView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny] # Chapa calls this, no JWT needed

    def get(self, request, tx_ref):
        """
        Chapa calls this after payment. In a real app, use a POST webhook.
        For simplicity, we use the return GET verification.
        """
        transaction = get_object_or_404(PaymentTransaction, tx_ref=tx_ref)
        
        # Here you would normally call Chapa Verify API to confirm success
        # For our MVP:
        transaction.status = 'success'
        transaction.save()
        
        # Mark the bill as paid
        transaction.bill.is_paid = True
        transaction.bill.save()

        return Response({"message": "Payment verified and bill updated"})

class ComplaintListCreateView(generics.ListCreateAPIView):
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

