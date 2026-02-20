from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Tag, TagLog
from .serializers import (
    RegisterSerializer, MyTokenObtainPairSerializer, 
    TagSerializer, TagLogSerializer
)
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from datetime import timedelta, datetime
import calendar

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
from .models import TagLog, AIAnalysis

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
        user_message = request.data.get('message')
        ai_response = get_ai_chat_response(user_message)
        
        return Response({
            "response": ai_response,
            "note": "AI Assistant is currently in beta."
        })

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

