import axios from 'axios';
import { hasValidToken } from '@/lib/auth';

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url : `${url}/`);

const getApiBaseUrl = () => {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return normalizeBaseUrl(envBaseUrl);
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000/api/`;
  }

  return 'http://127.0.0.1:8000/api/';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// Automatically add JWT to requests
api.interceptors.request.use((config) => {
  if (hasValidToken()) {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
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

export default api;
