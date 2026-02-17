"use client";

import { useEffect, useState } from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
    Activity, CreditCard, MessageSquare, Bot, Calendar, 
    TrendingUp, TrendingDown, Zap, Receipt, AlertCircle,
    Clock, ChevronDown, LogOut
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DashboardStats, UsageDataPoint, CostDataPoint, ActivityItem as ActivityItemType } from '@/lib/api';
import { dashboardApi } from '@/lib/api';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [usageData, setUsageData] = useState<UsageDataPoint[]>([]);
    const [costData, setCostData] = useState<CostDataPoint[]>([]);
    const [activities, setActivities] = useState<ActivityItemType[]>([]);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchDashboardData();
    }, [timeRange]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all dashboard data in parallel
            const [statsRes, usageRes, costRes, activityRes] = await Promise.all([
                dashboardApi.getStats(),
                dashboardApi.getUsageAnalytics(timeRange),
                dashboardApi.getCostAnalytics(timeRange),
                dashboardApi.getRecentActivity()
            ]);

            setStats(statsRes.data);
            setUsageData(Array.isArray(usageRes.data?.data) ? (usageRes.data.data as UsageDataPoint[]) : []);
            setCostData(Array.isArray(costRes.data?.data) ? (costRes.data.data as CostDataPoint[]) : []);
            setActivities(Array.isArray(activityRes.data?.activities) ? activityRes.data.activities : []);
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
            setError('Failed to load dashboard data. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.replace('/login');
    };

    // Calculate usage trend
    const usageTrend = (() => {
        if (usageData.length < 2) return '0';
        const start = usageData[0]?.usage ?? 0;
        const end = usageData[usageData.length - 1]?.usage ?? 0;
        if (!start) return '0';
        return (((end - start) / start) * 100).toFixed(1);
    })();

    // Calculate total usage
    const totalUsage = usageData.reduce((sum, item) => sum + item.usage, 0);

    // Calculate total cost
    const totalCost = costData.reduce((sum, item) => sum + item.cost, 0);

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button 
                        onClick={fetchDashboardData}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Welcome Back, Customer</h1>
                    <p className="text-slate-500 mt-1">Here&apos;s your energy overview</p>
                </div>
                <div className="flex gap-3">
                    {/* Time Range Selector */}
                    <div className="relative">
                        <select 
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
                            className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow transition-colors">
                        <Bot size={24} />
                    </button>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
                        aria-label="Logout"
                    >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </header>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Link
                    href="/dashboard/billing"
                    className="group bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-green-50 rounded-lg">
                            <CreditCard className="text-green-600" size={22} />
                        </div>
                        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                            Open →
                        </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">Billing</h2>
                    <p className="mt-1 text-sm text-slate-500">View bills and make secure payments.</p>
                </Link>

                <Link
                    href="/dashboard/complaints"
                    className="group bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-amber-50 rounded-lg">
                            <MessageSquare className="text-amber-600" size={22} />
                        </div>
                        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                            Open →
                        </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">Complaints</h2>
                    <p className="mt-1 text-sm text-slate-500">Submit and track support tickets.</p>
                </Link>

                <Link
                    href="/dashboard/ai-chat"
                    className="group bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
                >
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <Bot className="text-blue-600" size={22} />
                        </div>
                        <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">
                            Open →
                        </span>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-900">AI Chat</h2>
                    <p className="mt-1 text-sm text-slate-500">Ask questions about usage, bills, and tips.</p>
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                    title="Current Usage" 
                    value={`${stats?.current_usage_kwh.toFixed(1) || 0} kWh`} 
                    subtitle={`${Number(usageTrend) > 0 ? '+' : ''}${usageTrend}% from start`}
                    trend={Number(usageTrend) > 0 ? 'up' : 'down'}
                    icon={<Zap className="text-blue-500" />} 
                />
                <StatCard 
                    title="Pending Bill" 
                    value={`ETB ${stats?.pending_bill_etb.toLocaleString() || '0.00'}`} 
                    subtitle="Due in 5 days"
                    icon={<Receipt className="text-green-500" />} 
                />
                <StatCard 
                    title="Total Usage" 
                    value={`${totalUsage.toFixed(1)} kWh`} 
                    subtitle={`${timeRange === 'week' ? 'This week' : timeRange === 'month' ? 'This month' : 'This year'}`}
                    icon={<Activity className="text-purple-500" />} 
                />
                <StatCard 
                    title="Active Tickets" 
                    value={stats?.active_tickets.toString() || '0'} 
                    subtitle="Awaiting response"
                    icon={<MessageSquare className="text-amber-500" />} 
                />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Usage Analytics Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Usage Analytics</h2>
                            <p className="text-sm text-slate-500">Energy consumption over time</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar size={16} />
                            <span className="capitalize">{timeRange}</span>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={usageData}>
                                <defs>
                                    <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    formatter={(value) => [`${value as number} kWh`, 'Usage']}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="usage" 
                                    stroke="#2563eb" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#usageGradient)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cost Analytics Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Cost Analytics</h2>
                            <p className="text-sm text-slate-500">Estimated costs (ETB)</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">ETB {totalCost.toLocaleString()}</p>
                            <p className="text-sm text-slate-500">Total</p>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={costData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    formatter={(value) => [`ETB ${value as number}`, 'Cost']}
                                />
                                <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Charts Row 2 & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Usage vs Cost Comparison */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-900">Usage vs Cost Comparison</h2>
                            <p className="text-sm text-slate-500">Correlation between consumption and cost</p>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={usageData.map((u, i) => ({ ...u, cost: costData[i]?.cost || 0 }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis yAxisId="left" stroke="#2563eb" fontSize={12} />
                                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                />
                                <Line yAxisId="left" type="monotone" dataKey="usage" stroke="#2563eb" strokeWidth={2} name="Usage (kWh)" />
                                <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} name="Cost (ETB)" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
                        <Clock size={20} className="text-slate-400" />
                    </div>
                    <div className="space-y-4">
                        {activities.length > 0 ? (
                            activities.map((activity, index) => (
                                <ActivityItem key={index} activity={activity} />
                            ))
                        ) : (
                            <div className="text-center py-8 text-slate-500">
                                <p>No recent activity</p>
                            </div>
                        )}
                    </div>
                    <button className="w-full mt-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                        View All Activity
                    </button>
                </div>
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string;
    subtitle: string;
    trend?: 'up' | 'down';
    icon: React.ReactNode;
}

function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div className="p-3 bg-slate-50 rounded-lg">{icon}</div>
                {trend && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`}>
                        {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className="text-sm text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}

interface ActivityItemProps {
    activity: ActivityItemType;
}

function ActivityItem({ activity }: ActivityItemProps) {
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': return 'bg-green-100 text-green-700';
            case 'pending': return 'bg-amber-100 text-amber-700';
            case 'resolved': return 'bg-blue-100 text-blue-700';
            case 'investigating': return 'bg-purple-100 text-purple-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'bill': return <Receipt size={16} className="text-blue-500" />;
            case 'complaint': return <MessageSquare size={16} className="text-amber-500" />;
            default: return <Activity size={16} className="text-slate-500" />;
        }
    };

    const date = new Date(activity.date);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
            <div className="p-2 bg-slate-100 rounded-lg">
                {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{activity.description}</p>
                <p className="text-xs text-slate-500">{formattedDate}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
                {activity.status}
            </span>
        </div>
    );
}
