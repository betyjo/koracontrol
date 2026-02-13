from django.urls import path
from .views import (
    RegisterView, MyTokenObtainPairView, 
    TagListView, TagLogCreateView,
    BillListView, InitiatePaymentView, PaymentCallbackView,
    ComplaintListCreateView, ComplaintDetailView,
    AIAnalyzeView, AIChatView
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Auth Endpoints
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # SCADA / Industrial Endpoints
    path('tags/', TagListView.as_view(), name='tag_list'),
    path('logs/', TagLogCreateView.as_view(), name='log_create'),

    # Billing & Payment Endpoints
    path('billing/', BillListView.as_view(), name='bill_list'),
    path('payments/initiate/<int:bill_id>/', InitiatePaymentView.as_view(), name='pay_initiate'),
    path('payments/callback/<str:tx_ref>/', PaymentCallbackView.as_view(), name='pay_callback'),

    # Customer Support / Complaints
    path('complaints/', ComplaintListCreateView.as_view(), name='complaint_list_create'),
    path('complaints/<int:pk>/', ComplaintDetailView.as_view(), name='complaint_detail'),

    # AI & Analytics Endpoints
    path('ai/analyze/', AIAnalyzeView.as_view(), name='ai_analyze'),
    path('ai/chat/', AIChatView.as_view(), name='ai_chat'),
]
