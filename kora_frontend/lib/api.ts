import axios, { type AxiosRequestHeaders } from 'axios';
import { hasValidToken } from '@/lib/auth';

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url : `${url}/`);

const getApiBaseUrl = () => {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return normalizeBaseUrl(envBaseUrl);
  }

  // Default to a relative API path so the frontend can proxy requests
  // in dev or production without hard-coding ports or hostnames.
  // If the backend runs on another host/port, set `NEXT_PUBLIC_API_BASE_URL`.
  return '/api/';
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Automatically add JWT to requests
api.interceptors.request.use((config) => {
  try {
    if (hasValidToken()) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers = config.headers || {};
        const headers = config.headers as AxiosRequestHeaders;
        headers['Authorization'] = `Bearer ${token}`;
        config.headers = headers;
      }
    }
  } catch {
    // ignore token errors
  }
  // Ensure we don't send session cookies that trigger CSRF in Django
  config.withCredentials = false;
  return config;
});

// Handle 401 errors by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Dashboard API Endpoints ---

export interface DashboardStats {
  current_usage_kwh: number;
  pending_bill_etb: number;
  active_tickets: number;
}

export interface UsageDataPoint {
  name: string;
  usage: number;
}

export interface CostDataPoint {
  name: string;
  cost: number;
}

export interface AnalyticsResponse {
  time_range: string;
  data: UsageDataPoint[] | CostDataPoint[];
}

export interface ActivityItem {
  type: 'bill' | 'complaint';
  description: string;
  date: string;
  status: string;
}

export interface RecentActivityResponse {
  activities: ActivityItem[];
}

export interface ChatThread {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string;
}

export interface ChatMessage {
  id: number;
  thread: number;
  role: 'user' | 'ai' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatAttachment {
  id: number;
  thread: number;
  message: number | null;
  file_url: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string;
  created_at: string;
}

export interface AlarmEvent {
  id: number;
  rule: number;
  rule_name: string;
  tag_id: number;
  tag_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  level: 'warning' | 'alarm';
  state: 'active' | 'acknowledged' | 'returned' | 'shelved' | 'suppressed';
  triggered_value: number;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by_username: string | null;
  ack_note: string;
  shelved_until: string | null;
}

export interface AlarmKpis {
  standing_alarms: number;
  critical_open: number;
  total_events: number;
  acknowledged_events: number;
  ack_rate_percent: number;
}

export const dashboardApi = {
  // Get dashboard stats (current usage, pending bill, active tickets)
  getStats: () => api.get<DashboardStats>('/dashboard/stats/'),
  
  // Get usage analytics data for charts
  getUsageAnalytics: (timeRange: 'week' | 'month' | 'year' = 'week') => 
    api.get<AnalyticsResponse>(`/dashboard/usage/?time_range=${timeRange}`),
  
  // Get cost analytics data for charts
  getCostAnalytics: (timeRange: 'week' | 'month' | 'year' = 'month') => 
    api.get<AnalyticsResponse>(`/dashboard/cost/?time_range=${timeRange}`),
  
  // Get recent activity
  getRecentActivity: () => api.get<RecentActivityResponse>('/dashboard/activity/'),
};

export const aiChatApi = {
  listThreads: () => api.get<ChatThread[]>('/ai/threads/'),
  createThread: (title = 'New chat') => api.post<ChatThread>('/ai/threads/', { title }),
  updateThread: (threadId: number, payload: Partial<Pick<ChatThread, 'title'>>) =>
    api.patch<ChatThread>(`/ai/threads/${threadId}/`, payload),
  deleteThread: (threadId: number) => api.delete(`/ai/threads/${threadId}/`),

  listMessages: (threadId: number) => api.get<ChatMessage[]>(`/ai/threads/${threadId}/messages/`),
  sendMessage: (threadId: number, message: string) =>
    api.post(`/ai/threads/${threadId}/messages/`, { message }),

  uploadAttachment: (threadId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ChatAttachment>(`/ai/threads/${threadId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  exportThread: (threadId: number, format: 'json' | 'csv' = 'json') =>
    api.get(`/ai/threads/${threadId}/export/?format=${format}`, { responseType: 'blob' }),
};

export const alarmApi = {
  listEvents: (params?: { state?: string; severity?: string; tag_id?: number }) =>
    api.get<AlarmEvent[]>('/alarms/events/', { params }),
  getKpis: () => api.get<AlarmKpis>('/alarms/kpis/'),
  acknowledge: (eventId: number, ack_note = '') =>
    api.post<AlarmEvent>(`/alarms/events/${eventId}/ack/`, { ack_note }),
  shelve: (eventId: number, minutes = 30, shelve_note = '') =>
    api.post<AlarmEvent>(`/alarms/events/${eventId}/shelve/`, { minutes, shelve_note }),
  unshelve: (eventId: number) => api.post<AlarmEvent>(`/alarms/events/${eventId}/unshelve/`),
};

export interface PlantOverviewEquipment {
  id: number;
  code: string;
  name: string;
  primary_tag_id: number | null;
  primary_tag_name: string | null;
  map_rect: { x?: number; y?: number; width?: number; height?: number };
  has_open_alarm?: boolean;
  alarm_count?: number;
  last_seen?: string | null;
  offline?: boolean;
  // Legacy compatibility
  current_value: number | null;
}

export interface PlantOverviewArea {
  id: number;
  code: string;
  name: string;
  sort_order?: number;
  open_alarm_count?: number;
  layout: Record<string, unknown>;
  equipment: PlantOverviewEquipment[];
}

export interface MaintenanceTask {
  id: number;
  asset: number | null;
  asset_name: string | null;
  title: string;
  description: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_by: number;
  created_by_username: string;
  assigned_to: number | null;
  assigned_to_username: string | null;
  planned_start: string | null;
  planned_end: string | null;
  completed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  // Legacy compatibility
  scheduled_for?: string;
}

export interface QualityMetric {
  id: number;
  area: number | null;
  area_name: string | null;
  tag: number | null;
  tag_name: string | null;
  metric_name: string;
  current_value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  threshold_low: number | null;
  threshold_high: number | null;
  last_updated: string;
  created_at: string;
  // Legacy compatibility
  name?: string;
  value?: number;
  updated_at?: string;
}

export interface EquipmentHealth {
  id: number;
  equipment: number;
  equipment_name: string;
  health_score: string;
  condition: string;
  last_inspection_at: string | null;
  next_due_at: string | null;
  recommended_action: string;
  created_at: string;
  updated_at: string;
  // Legacy compatibility
  asset_name?: string;
  last_maintenance?: string;
  next_maintenance_due?: string;
  notes?: string;
}

export interface DashboardKpiSummary {
  flow_peak: number;
  flow_avg: number;
  flow_min: number;
  flow_total_24h: number;
  water_balance: number;
  quality_pct: number;
  pump_running: boolean | null;
  active_alarms: number;
  recent_operator_events: Array<{
    id: number;
    title: string;
    occurred_at: string | null;
    author: string;
  }>;
}

export interface BillForecast {
  forecast_amount: number;
  forecast_usage: number;
  rate_per_unit: number;
  trend_pct: number;
  avg_amount: number;
  confidence: 'low' | 'medium' | 'high';
  usage_trend: Array<{ month: string; amount: number; usage: number }>;
}

export interface ServiceOutage {
  id: number;
  title: string;
  severity: string;
  message: string;
  triggered_at: string;
  state: string;
}

export interface UsageComparison {
  this_month: { usage: number; cost: number };
  last_month: { usage: number; cost: number };
  change_pct: number;
}

export const operationsApi = {
  getPlantOverview: () => api.get<{ areas: PlantOverviewArea[] }>('/operations/plant-overview/'),
  getMaintenanceTasks: () => api.get<MaintenanceTask[]>('/operations/maintenance/tasks/'),
  createMaintenanceTask: (data: Partial<MaintenanceTask>) => api.post<MaintenanceTask>('/operations/maintenance/tasks/', data),
  updateMaintenanceTask: (id: number, data: Partial<MaintenanceTask>) => api.patch<MaintenanceTask>(`/operations/maintenance/tasks/${id}/`, data),
  deleteMaintenanceTask: (id: number) => api.delete(`/operations/maintenance/tasks/${id}/`),
  getQualityMetrics: () => api.get<QualityMetric[]>('/operations/quality-metrics/'),
  getEquipmentHealth: () => api.get<EquipmentHealth[]>('/operations/equipment-health/'),
  getProcessState: () => api.get<ProcessState>('/operations/process-state/'),
};

export interface TankState {
  level: number;
  inflow: number;
  outflow: number;
  pressure?: number;
  temperature?: number;
}

export interface ProcessState {
  tankA: TankState;
  tankB: TankState;
  tankC: TankState;
  mainFlow: number;
  pressure: number;
  temperature: number;
  totalVolume?: number;
  pumpStatus: 'running' | 'stopped' | 'fault';
  valveStatus: { inlet: boolean; outlet: boolean; bypass: boolean };
  source?: string;
  lastUpdate?: string | null;
}

export const dashboardKpiApi = {
  getKpiSummary: () => api.get<DashboardKpiSummary>('/dashboard/kpis/'),
  getBillForecast: () => api.get<BillForecast>('/dashboard/bill-forecast/'),
  getServiceOutages: () => api.get<{ outages: ServiceOutage[]; count: number }>('/dashboard/service-outages/'),
  getUsageComparison: () => api.get<UsageComparison>('/dashboard/usage-comparison/'),
};

export default api;

export interface AIAnalysisRequest {
  tag_id: number;
}

export interface AIAnalysisResponse {
  is_anomaly: boolean;
  confidence: number;
  explanation: string;
  status: string;
}

export interface AIAnalysisRow extends AIAnalysisResponse {
  id: number;
  tag_id: number;
  created_at: string;
  updated_at?: string;
}

export const aiAnalysisApi = {
  analyzeTag: (tagId: number) =>
    api.post<AIAnalysisResponse>('/ai/analyze/', { tag_id: tagId }),
  getAnalyses: () => api.get<AIAnalysisRow[]>('/ai/analyses/'),
};

// --- AI Intelligence Types & API ---

export interface AIAnomalyDashboard {
  anomaly_count_24h: number;
  anomaly_count_7d: number;
  avg_confidence: number;
  top_anomalous_tags: Array<{ tag_name: string; count: number }>;
  recent_detections: Array<{
    id: number;
    finding_type: string;
    tag_name: string | null;
    result_json: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface AIPredictiveMaintenanceItem {
  tag_name: string;
  equipment_name: string;
  health_score: number;
  variance: number;
  prediction: string;
  recommended_action: string;
}

export interface AIAlarmPriority {
  id: number;
  rule_name: string;
  tag_name: string;
  severity: string;
  state: string;
  triggered_at: string;
  priority_score: number;
  ai_recommendation: string;
}

export interface AIRootCauseResult {
  event_id: number;
  root_cause: string;
  confidence: number;
  correlated_tags: Array<{ tag_name: string; deviation: number }>;
  explanation: string;
  recommendations: string[];
}

export interface AITrendAbnormalityResult {
  tag_name: string;
  is_abnormal: boolean;
  z_score: number;
  rate_of_change: number;
  trend_direction: string;
  confidence: number;
  explanation: string;
}

export interface AIFinding {
  id: number;
  finding_type: 'anomaly' | 'prediction' | 'prioritization' | 'root_cause' | 'trend_abnormality';
  tag: number | null;
  tag_name: string | null;
  alarm_event: number | null;
  result_json: Record<string, unknown>;
  created_at: string;
}

export interface OperatorActionLog {
  id: number;
  user: number;
  username: string;
  action_type: string;
  target_tag: number | null;
  tag_name: string | null;
  description: string;
  old_value: string;
  new_value: string;
  ip_address: string | null;
  created_at: string;
}

export interface EquipmentHealthItem {
  equipment_type: string;
  equipment_id: string;
  health_score: number;
  status: 'healthy' | 'degrading' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  metrics: Record<string, unknown>;
  timestamp: number;
}

export interface MaintenanceAlert {
  alert_type: 'degradation' | 'efficiency_loss' | 'stuck' | 'wear';
  severity: 'info' | 'warning' | 'critical';
  equipment_type: string;
  equipment_id: string;
  message: string;
  confidence: number;
  recommended_action: string;
  estimated_days_to_failure: number | null;
  timestamp: number;
}

export interface RootCauseAnalysis {
  pattern: string;
  description: string;
  recommendation: string;
  confidence: number;
}

export interface EnergyAdvisoryMetrics {
  current_power_kw: number;
  daily_consumption_kwh: number;
  monthly_consumption_kwh: number;
  peak_demand_kw: number;
  power_factor: number;
  efficiency_rating: string;
  cost_per_cubic_meter: number;
  specific_energy_kwh_per_m3: number;
  timestamp: number;
}

export interface EnergyRecommendation {
  category: string;
  priority: string;
  title: string;
  description: string;
  estimated_savings_pct: number;
  estimated_savings_etb: number;
  implementation_effort: string;
  metrics: Record<string, unknown>;
  timestamp: number;
}

export interface EnergyAdvisoryResponse {
  type: string;
  source: string;
  metrics: EnergyAdvisoryMetrics;
  recommendations: EnergyRecommendation[];
  total_recommendations: number;
  estimated_monthly_savings_etb: number;
  timestamp: number;
}

export const aiInsightsApi = {
  getAnomalyDashboard: () => api.get<AIAnomalyDashboard>('/ai/anomaly-dashboard/'),
  getPredictiveMaintenance: () => api.get<AIPredictiveMaintenanceItem[]>('/ai/predictive-maintenance/'),
  getAlarmPrioritization: () => api.get<AIAlarmPriority[]>('/ai/alarm-prioritization/'),
  getRootCause: (alarmEventId: number) => api.post<AIRootCauseResult>('/ai/root-cause/', { event_id: alarmEventId }),
  getTrendAbnormality: (tagId: number) => api.post<AITrendAbnormalityResult>('/ai/trend-abnormality/', { tag_id: tagId }),
  getFindings: (params?: { finding_type?: string; tag_id?: number }) =>
    api.get<AIFinding[]>('/ai/findings/', { params }),
  getOperatorActions: (params?: { action_type?: string; since?: string }) =>
    api.get<OperatorActionLog[]>('/audit/operator-actions/', { params }),
  getEquipmentHealth: () => api.get<EquipmentHealthItem[]>('/ai/equipment-health/'),
  getMaintenanceAlerts: () => api.get<MaintenanceAlert[]>('/ai/maintenance-alerts/'),
  getEnergyAdvisory: () => api.get<EnergyAdvisoryResponse>('/ai/energy-advisory/'),
};
