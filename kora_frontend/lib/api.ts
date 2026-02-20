import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Automatically add JWT to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

export default api;
