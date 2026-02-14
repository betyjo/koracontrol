from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Tag, TagLog
from .serializers import (
    RegisterSerializer, MyTokenObtainPairSerializer, 
    TagSerializer, TagLogSerializer
)

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

class TagLogCreateView(generics.CreateAPIView):
    """
    Team 1 uses this to send actual PLC values.
    Endpoint: /api/logs/
    """
    queryset = TagLog.objects.all()
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

