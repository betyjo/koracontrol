from django.urls import path
from .views import (
    RegisterView, MyTokenObtainPairView, BiometricLoginView,
    TagListView, TagLogListCreateView,
    BillListView, InitiatePaymentView, PaymentTransactionListView, PaymentCallbackView,
    ComplaintListCreateView, ComplaintDetailView,
    AlarmRuleListCreateView, AlarmEventListView, AlarmAcknowledgeView, AlarmShelveView, AlarmUnshelveView, AlarmKPIView,
    AIAnalyzeView, AIAnalysisListView, AIChatView, AIThreadListCreateView, AIThreadDetailView,
    AIThreadMessageListView, AIThreadStreamView, AIThreadAttachmentUploadView, AIThreadExportView,
    DashboardStatsView, DashboardVizLiveView, UsageAnalyticsView, CostAnalyticsView, RecentActivityView,
    DashboardKpiSummaryView, BillForecastView, ServiceOutageView, UsageComparisonView,
    UserProfileView, ChangePasswordView, DeleteAccountView,
    ForgotPasswordRequestView, ResetPasswordView, GoogleAuthView,
    OperatorActionLogListView,
    AIAnomalyDashboardView, AIPredictiveMaintenanceView, AIAlarmPrioritizationView,
    AIRootCauseView, AITrendAbnormalityView, AIFindingListView,
    AIEquipmentHealthView, AIMaintenanceAlertsView, AIEnergyAdvisoryView,
    RealtimeStreamView,
    AuditTrailView, AuditTrailStatsView, AuditTrailExportView,
    ReportDailySummaryView, ReportAlarmAnalysisView, ReportEquipmentHealthView, ReportPerformanceView,
)
from .operations_views import (
    HistoryQueryView,
    HistoryExportCsvView,
    TrendAnnotationListCreateView,
    PlantOverviewView,
    MaintenanceTaskListCreateView,
    MaintenanceTaskDetailView,
    ProcessSetpointListCreateView,
    ProcessSetpointDetailView,
    WaterQualityMetricListView,
    EquipmentHealthListView,
    OperatorJournalListCreateView,
    InAppNotificationListView,
    InAppNotificationMarkReadView,
    InAppNotificationMarkAllReadView,
    NotificationSubscriptionListCreateView,
    NotificationSubscriptionDetailView,
    EvaluateComplaintSlaView,
    ProcessStateView,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Auth Endpoints
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/biometric-login/', BiometricLoginView.as_view(), name='biometric_login'),
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
    path('operations/maintenance/tasks/', MaintenanceTaskListCreateView.as_view(), name='maintenance_tasks'),
    path('operations/maintenance/tasks/<int:pk>/', MaintenanceTaskDetailView.as_view(), name='maintenance_task_detail'),
    path('operations/setpoints/', ProcessSetpointListCreateView.as_view(), name='setpoints'),
    path('operations/setpoints/<int:pk>/', ProcessSetpointDetailView.as_view(), name='setpoint_detail'),
    path('operations/quality-metrics/', WaterQualityMetricListView.as_view(), name='quality_metrics'),
    path('operations/equipment-health/', EquipmentHealthListView.as_view(), name='equipment_health'),
    path('operations/journal/', OperatorJournalListCreateView.as_view(), name='operator_journal'),
    path('operations/evaluate-sla/', EvaluateComplaintSlaView.as_view(), name='evaluate_complaint_sla'),
    path('operations/process-state/', ProcessStateView.as_view(), name='process_state'),
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

    # AI Intelligence Endpoints
    path('ai/anomaly-dashboard/', AIAnomalyDashboardView.as_view(), name='ai_anomaly_dashboard'),
    path('ai/predictive-maintenance/', AIPredictiveMaintenanceView.as_view(), name='ai_predictive_maintenance'),
    path('ai/alarm-prioritization/', AIAlarmPrioritizationView.as_view(), name='ai_alarm_prioritization'),
    path('ai/root-cause/', AIRootCauseView.as_view(), name='ai_root_cause'),
    path('ai/trend-abnormality/', AITrendAbnormalityView.as_view(), name='ai_trend_abnormality'),
    path('ai/findings/', AIFindingListView.as_view(), name='ai_findings'),
    path('ai/equipment-health/', AIEquipmentHealthView.as_view(), name='ai_equipment_health'),
    path('ai/maintenance-alerts/', AIMaintenanceAlertsView.as_view(), name='ai_maintenance_alerts'),
    path('ai/energy-advisory/', AIEnergyAdvisoryView.as_view(), name='ai_energy_advisory'),

    # Audit Endpoints
    path('audit/operator-actions/', OperatorActionLogListView.as_view(), name='operator_action_log'),
    path('audit/trail/', AuditTrailView.as_view(), name='audit_trail'),
    path('audit/trail/stats/', AuditTrailStatsView.as_view(), name='audit_trail_stats'),
    path('audit/trail/export/', AuditTrailExportView.as_view(), name='audit_trail_export'),

    # Real-time SSE Endpoint
    path('realtime/stream/', RealtimeStreamView.as_view(), name='realtime_stream'),

    # Report Generation Endpoints
    path('reports/daily-summary/', ReportDailySummaryView.as_view(), name='report_daily_summary'),
    path('reports/alarm-analysis/', ReportAlarmAnalysisView.as_view(), name='report_alarm_analysis'),
    path('reports/equipment-health/', ReportEquipmentHealthView.as_view(), name='report_equipment_health'),
    path('reports/performance/', ReportPerformanceView.as_view(), name='report_performance'),

    # Dashboard Endpoints
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('dashboard/viz-live/', DashboardVizLiveView.as_view(), name='dashboard_viz_live'),
    path('dashboard/usage/', UsageAnalyticsView.as_view(), name='usage_analytics'),
    path('dashboard/cost/', CostAnalyticsView.as_view(), name='cost_analytics'),
    path('dashboard/activity/', RecentActivityView.as_view(), name='recent_activity'),
    path('dashboard/kpis/', DashboardKpiSummaryView.as_view(), name='dashboard_kpis'),
    path('dashboard/bill-forecast/', BillForecastView.as_view(), name='bill_forecast'),
    path('dashboard/service-outages/', ServiceOutageView.as_view(), name='service_outages'),
    path('dashboard/usage-comparison/', UsageComparisonView.as_view(), name='usage_comparison'),

    # User Profile & Security
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('profile/delete/', DeleteAccountView.as_view(), name='delete_account'),
]
