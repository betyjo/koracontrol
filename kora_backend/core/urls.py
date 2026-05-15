from django.urls import path
from .views import (
    RegisterView, MyTokenObtainPairView,
    TagListView, TagLogListCreateView,
    BillListView, InitiatePaymentView, PaymentTransactionListView, PaymentCallbackView,
    ComplaintListCreateView, ComplaintDetailView,
    AlarmRuleListCreateView, AlarmEventListView, AlarmAcknowledgeView, AlarmShelveView, AlarmUnshelveView, AlarmKPIView,
    AIAnalyzeView, AIAnalysisListView, AIChatView, AIThreadListCreateView, AIThreadDetailView,
    AIThreadMessageListView, AIThreadStreamView, AIThreadAttachmentUploadView, AIThreadExportView,
    DashboardStatsView, DashboardVizLiveView, UsageAnalyticsView, CostAnalyticsView, RecentActivityView,
    UserProfileView, ChangePasswordView, DeleteAccountView,
    ForgotPasswordRequestView, ResetPasswordView, GoogleAuthView
)
from .operations_views import (
    HistoryQueryView,
    HistoryExportCsvView,
    TrendAnnotationListCreateView,
    PlantOverviewView,
    OperatorJournalListCreateView,
    InAppNotificationListView,
    InAppNotificationMarkReadView,
    InAppNotificationMarkAllReadView,
    NotificationSubscriptionListCreateView,
    NotificationSubscriptionDetailView,
    EvaluateComplaintSlaView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Auth Endpoints
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/forgot-password/', ForgotPasswordRequestView.as_view(), name='forgot_password'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    path('auth/google/', GoogleAuthView.as_view(), name='auth_google'),

    # SCADA / Industrial Endpoints
    path('tags/', TagListView.as_view(), name='tag_list'),
    path('logs/', TagLogListCreateView.as_view(), name='log_list_create'),
    path('history/query/', HistoryQueryView.as_view(), name='history_query'),
    path('history/export.csv/', HistoryExportCsvView.as_view(), name='history_export_csv'),
    path('trends/annotations/', TrendAnnotationListCreateView.as_view(), name='trend_annotations'),
    path('operations/plant-overview/', PlantOverviewView.as_view(), name='plant_overview'),
    path('operations/journal/', OperatorJournalListCreateView.as_view(), name='operator_journal'),
    path('operations/evaluate-sla/', EvaluateComplaintSlaView.as_view(), name='evaluate_complaint_sla'),
    path('notifications/', InAppNotificationListView.as_view(), name='in_app_notifications'),
    path('notifications/mark-all-read/', InAppNotificationMarkAllReadView.as_view(), name='notifications_mark_all_read'),
    path('notifications/<int:pk>/read/', InAppNotificationMarkReadView.as_view(), name='notification_mark_read'),
    path('notifications/subscriptions/', NotificationSubscriptionListCreateView.as_view(), name='notification_subscriptions'),
    path('notifications/subscriptions/<int:pk>/', NotificationSubscriptionDetailView.as_view(), name='notification_subscription_detail'),

    # Billing & Payment Endpoints
    path('billing/', BillListView.as_view(), name='bill_list'),
    path('payments/initiate/<int:bill_id>/', InitiatePaymentView.as_view(), name='pay_initiate'),
    path(
        'payments/transactions/',
        PaymentTransactionListView.as_view(),
        name='payment_transaction_list',
    ),
    path('payments/callback/<str:tx_ref>/', PaymentCallbackView.as_view(), name='pay_callback'),

    # Customer Support / Complaints
    path('complaints/', ComplaintListCreateView.as_view(), name='complaint_list_create'),
    path('complaints/<int:pk>/', ComplaintDetailView.as_view(), name='complaint_detail'),
    path('alarms/rules/', AlarmRuleListCreateView.as_view(), name='alarm_rule_list_create'),
    path('alarms/events/', AlarmEventListView.as_view(), name='alarm_event_list'),
    path('alarms/events/<int:event_id>/ack/', AlarmAcknowledgeView.as_view(), name='alarm_ack'),
    path('alarms/events/<int:event_id>/shelve/', AlarmShelveView.as_view(), name='alarm_shelve'),
    path('alarms/events/<int:event_id>/unshelve/', AlarmUnshelveView.as_view(), name='alarm_unshelve'),
    path('alarms/kpis/', AlarmKPIView.as_view(), name='alarm_kpis'),

    # AI & Analytics Endpoints
    path('ai/analyze/', AIAnalyzeView.as_view(), name='ai_analyze'),
    path('ai/analyses/', AIAnalysisListView.as_view(), name='ai_analyses'),
    path('ai/chat/', AIChatView.as_view(), name='ai_chat'),
    path('ai/threads/', AIThreadListCreateView.as_view(), name='ai_thread_list_create'),
    path('ai/threads/<int:pk>/', AIThreadDetailView.as_view(), name='ai_thread_detail'),
    path('ai/threads/<int:thread_id>/messages/', AIThreadMessageListView.as_view(), name='ai_thread_messages'),
    path('ai/threads/<int:thread_id>/chat/stream/', AIThreadStreamView.as_view(), name='ai_thread_stream'),
    path('ai/threads/<int:thread_id>/attachments/', AIThreadAttachmentUploadView.as_view(), name='ai_thread_attachment_upload'),
    path('ai/threads/<int:thread_id>/export/', AIThreadExportView.as_view(), name='ai_thread_export'),

    # Dashboard Endpoints
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('dashboard/viz-live/', DashboardVizLiveView.as_view(), name='dashboard_viz_live'),
    path('dashboard/usage/', UsageAnalyticsView.as_view(), name='usage_analytics'),
    path('dashboard/cost/', CostAnalyticsView.as_view(), name='cost_analytics'),
    path('dashboard/activity/', RecentActivityView.as_view(), name='recent_activity'),

    # User Profile & Security
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('profile/delete/', DeleteAccountView.as_view(), name='delete_account'),
]
