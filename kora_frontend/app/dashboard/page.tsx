"use client";
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { alarmApi, dashboardKpiApi, aiInsightsApi, type DashboardKpiSummary, type ServiceOutage, type EnergyAdvisoryResponse, type EquipmentHealthItem, type MaintenanceAlert } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, CreditCard, MessageSquare, Loader2, Droplet, ShieldCheck, BellRing, Gauge, Brain, Zap, HeartPulse, Wrench, AlertTriangle } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import DashboardScadaSection from '@/components/dashboard-viz/DashboardScadaSection';
import { getUserRole, getWelcomeMessage, getDashboardSubtitle, UserRole, hasPermission } from '@/lib/permissions';

interface TagLog {
    id: number;
    tag_name: string;
    value: number;
    quality_code: string;
    timestamp: string;
}

interface ChartPoint {
    time: string;
    value: number;
    original?: TagLog;
}

interface AlarmEvent {
    id: number;
    message?: string;
    rule_name?: string;
    triggered_at: string;
    severity?: string;
    state?: string;
}

interface Stats {
    usage: number;
    bill: number;
    tickets: number;
}

interface Bill {
    id: number;
    amount: string;
    usage_kwh: number;
    is_paid: boolean;
    billing_date: string;
}

interface Complaint {
    id: number;
    subject: string;
    description: string;
    status: 'pending' | 'investigating' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
}

export default function Dashboard() {
    const router = useRouter();
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [stats, setStats] = useState<Stats>({ usage: 0, bill: 0, tickets: 0 });
    const [bills, setBills] = useState<Bill[]>([]);
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<UserRole>('CUSTOMER');
    const [qualityFilter, setQualityFilter] = useState<'all' | 'good' | 'bad'>('all');
    const [kpiSummary, setKpiSummary] = useState<DashboardKpiSummary | null>(null);
    const [serviceOutages, setServiceOutages] = useState<ServiceOutage[]>([]);
    const [paying, setPaying] = useState(false);
    const [energyAdvisory, setEnergyAdvisory] = useState<EnergyAdvisoryResponse | null>(null);
    const [equipmentHealthList, setEquipmentHealthList] = useState<EquipmentHealthItem[]>([]);
    const [maintenanceAlertsList, setMaintenanceAlertsList] = useState<MaintenanceAlert[]>([]);

    const fetchData = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const logRes = await api.get('/logs/');

            // Filter for Flow_Rate or Tank_Level
            const filteredLogs = logRes.data.filter((l: TagLog) => l.tag_name === 'Flow_Rate');
            
            const formattedData = filteredLogs.slice(0, 15).reverse().map((log: TagLog) => ({
                time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                value: log.value,
                original: log // Keep full log for the reader list
            }));

            setChartData(formattedData);

            if (filteredLogs.length > 0) {
                setStats(prev => ({ ...prev, usage: filteredLogs[0].value }));
            } else if (logRes.data.length > 0) {
                // Fallback to first available tag if Main_Consumption is not present yet
                setStats(prev => ({ ...prev, usage: logRes.data[0].value }));
            }

            // Fetch live bills if user has permission
            if (userRole === 'CUSTOMER' && hasPermission(userRole, 'canViewBilling')) {
                const billsRes = await api.get<Bill[]>('billing/');
                setBills(billsRes.data);
                
                const unpaidSum = billsRes.data.filter(b => !b.is_paid).reduce((sum, b) => sum + parseFloat(b.amount), 0);
                setStats(prev => ({ ...prev, bill: unpaidSum }));
            }

            // Fetch live complaints if user has permission
            if (hasPermission(userRole, 'canViewComplaints')) {
                const compRes = await api.get<Complaint[]>('complaints/');
                setComplaints(compRes.data);
                
                const activeCount = compRes.data.filter(c => c.status !== 'resolved').length;
                setStats(prev => ({ ...prev, tickets: activeCount }));
            }

        } catch (err: unknown) {
            console.error("Dashboard data fetch failed:", err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [userRole]);


    const [criticalAlarms, setCriticalAlarms] = useState<AlarmEvent[]>([]);

    const fetchAlarms = useCallback(async () => {
        try {
            await alarmApi.getKpis();
            const eventsRes = await alarmApi.listEvents({ state: 'active', severity: 'critical' });
            setCriticalAlarms(eventsRes.data || []);
        } catch (err) {
            console.error('Failed to load alarms:', err);
        }
    }, []);

    const fetchKpis = useCallback(async () => {
        try {
            const [kpiRes, outageRes] = await Promise.all([
                dashboardKpiApi.getKpiSummary(),
                dashboardKpiApi.getServiceOutages(),
            ]);
            setKpiSummary(kpiRes.data);
            setServiceOutages(outageRes.data.outages || []);
        } catch (err) {
            console.error('Failed to load KPIs:', err);
        }
    }, []);

    const fetchAIAdvisory = useCallback(async () => {
        try {
            const [energyRes, healthRes, alertsRes] = await Promise.allSettled([
                aiInsightsApi.getEnergyAdvisory(),
                aiInsightsApi.getEquipmentHealth(),
                aiInsightsApi.getMaintenanceAlerts(),
            ]);
            if (energyRes.status === 'fulfilled') setEnergyAdvisory(energyRes.value.data);
            if (healthRes.status === 'fulfilled') setEquipmentHealthList(healthRes.value.data);
            if (alertsRes.status === 'fulfilled') setMaintenanceAlertsList(alertsRes.value.data);
        } catch (err) {
            console.error('Failed to load AI advisory:', err);
        }
    }, []);

    useEffect(() => {
        // Extract role from token using permission utility
        const role = getUserRole();
        if (role) {
            setUserRole(role);
        }

        fetchData(true);
        fetchAlarms();
        fetchKpis();
        fetchAIAdvisory();
        const interval = setInterval(() => { 
            fetchData(false); 
            fetchAlarms(); 
            fetchKpis(); 
            fetchAIAdvisory();
        }, 5000);
        return () => clearInterval(interval);
    }, [userRole, fetchData, fetchAlarms, fetchKpis, fetchAIAdvisory]);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Compute greeting only after mount to avoid hydration mismatch
    // (getUsername reads localStorage, getHours depends on client timezone)
    const welcomeMessage = mounted ? getWelcomeMessage(userRole) : 'Welcome!';
    const dashboardSubtitle = getDashboardSubtitle(userRole);

    // Derived values for billing and complaints (used to replace hardcoded UI)
    const paidBills = bills
        .filter(b => b.is_paid)
        .sort((a, b) => new Date(b.billing_date).getTime() - new Date(a.billing_date).getTime());

    const lastPayment = paidBills.length > 0 ? paidBills[0] : null;

    const upcomingBills = bills
        .filter(b => !b.is_paid)
        .sort((a, b) => new Date(a.billing_date).getTime() - new Date(b.billing_date).getTime());

    const nextBilling = upcomingBills.length > 0 ? upcomingBills[0] : null;

    const handlePayNow = async () => {
        const unpaidBill = upcomingBills[0];
        if (!unpaidBill) {
            router.push('/dashboard/billing');
            return;
        }
        setPaying(true);
        try {
            const res = await api.post(`payments/initiate/${unpaidBill.id}/`);
            const checkoutUrl = res.data?.checkout_url;
            if (checkoutUrl) {
                window.location.href = checkoutUrl;
            } else {
                router.push('/dashboard/billing');
            }
        } catch {
            router.push('/dashboard/billing');
        } finally {
            setPaying(false);
        }
    };

    const activeComplaints = complaints.filter(c => c.status !== 'resolved');
    const firstActiveComplaint = activeComplaints.length > 0 ? activeComplaints[0] : null;

    return (
        <PageTransition>
            <div className="p-6 max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 md:p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    {welcomeMessage}
                                </h1>
                                <p className="mt-2 text-slate-600 dark:text-slate-300">
                                    {dashboardSubtitle}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                                <MiniInsight
                                    icon={<Droplet size={16} className="text-blue-500" />}
                                    label="Flow Rate"
                                    value={`${stats.usage} L/min`}
                                />
                                <MiniInsight
                                    icon={<Gauge size={16} className="text-cyan-500" />}
                                    label="Sensor Health"
                                    value={chartData.length > 0 ? "Stable" : "Syncing"}
                                />
                                <MiniInsight
                                    icon={<ShieldCheck size={16} className="text-emerald-500" />}
                                    label="System Status"
                                    value="Online"
                                />
                                {hasPermission(userRole, 'canViewComplaints') && (
                                    <MiniInsight
                                        icon={<MessageSquare size={16} className="text-violet-500" />}
                                        label="Open Tickets"
                                        value={`${stats.tickets}`}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Live Alarm Banner */}
                {serviceOutages.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <BellRing className="text-red-600 animate-pulse" size={18} />
                            <span className="font-bold text-red-800 dark:text-red-200 text-sm uppercase tracking-wider">
                                {serviceOutages.length} Active Service {serviceOutages.length === 1 ? 'Alert' : 'Alerts'}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {serviceOutages.slice(0, 3).map((o) => (
                                <div key={o.id} className="flex items-center justify-between text-sm">
                                    <span className="text-red-700 dark:text-red-300 font-medium">{o.title}</span>
                                    <span className="text-xs text-red-500">{new Date(o.triggered_at).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-blue-600" size={48} />
                    </div>
                ) : (
                    <>
                        {userRole === 'ADMIN' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <Activity className="text-blue-600" size={20} />
                                        System Health Monitor
                                    </h2>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                                <XAxis dataKey="time" hide />
                                                <YAxis hide />
                                                <Tooltip />
                                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
                                        <h3 className="font-bold mb-4 uppercase tracking-wider text-xs opacity-80">User Activity</h3>
                                        <div className="text-4xl font-bold mb-1">124</div>
                                        <p className="text-sm opacity-80">Active sessions today</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <h3 className="font-bold mb-4 text-slate-900 dark:text-white">Quick Actions</h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            <button className="text-left px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm font-medium hover:bg-blue-50 hover:text-blue-600 transition-all">Audit System Logs</button>
                                            <button className="text-left px-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm font-medium hover:bg-blue-50 hover:text-blue-600 transition-all">Manage User Roles</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent Operator Events (for admin/operator) */}
                        {(userRole === 'ADMIN' || userRole === 'OPERATOR') && kpiSummary?.recent_operator_events && kpiSummary.recent_operator_events.length > 0 && (
                            <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Activity className="text-blue-600" size={20} />
                                    Recent Operator Events
                                </h2>
                                <div className="space-y-3">
                                    {kpiSummary.recent_operator_events.map((evt) => (
                                        <div key={evt.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                            <div>
                                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{evt.title}</span>
                                                <span className="text-xs text-slate-500 ml-2">by {evt.author}</span>
                                            </div>
                                            <span className="text-xs text-slate-400">{evt.occurred_at ? new Date(evt.occurred_at).toLocaleString() : '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {userRole === 'OPERATOR' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="md:col-span-2 lg:col-span-3">
                                    <DashboardScadaSection />
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <BellRing className="text-red-500" size={18} />
                                        Unacked Alarms
                                    </h2>
                                    {criticalAlarms.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">No active critical alarms.</div>
                                        ) : (
                                    criticalAlarms.slice(0,3).map(a => (
                                    <div key={a.id} className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                    <div className="text-xs font-bold text-red-600 mb-1 uppercase">Critical</div>
                                    <div className="text-sm font-bold">{a.message || a.rule_name}</div>
                                    <div className="text-[10px] text-slate-500">{new Date(a.triggered_at).toLocaleString()}</div>
                                    </div>
                                           ))
                                         )}
                                    <button onClick={() => router.push('/dashboard/alarms')} className="w-full py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all">View All Alarms</button>
                                </div>
                            </div>
                        )}

                        {userRole === 'CUSTOMER' && hasPermission(userRole, 'canViewBilling') && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <CreditCard className="text-blue-600" size={20} />
                                        Billing & Payment
                                    </h2>
                                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl mb-4">
                                        <div>
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Outstanding Balance</div>
                                            <div className="text-3xl font-bold">${stats.bill}</div>
                                        </div>
                                        {hasPermission(userRole, 'canManageBilling') && (
                                            <button onClick={handlePayNow} disabled={paying || upcomingBills.length === 0} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer">
                                                {paying && <Loader2 size={16} className="animate-spin" />}
                                                {paying ? 'Processing...' : 'Pay Now'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Last Payment</span>
                                            <span className="font-medium">{lastPayment ? `$${parseFloat(lastPayment.amount).toFixed(2)} (${new Date(lastPayment.billing_date).toLocaleDateString()})` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Next Billing Date</span>
                                            <span className="font-medium">{nextBilling ? new Date(nextBilling.billing_date).toLocaleDateString() : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                                {hasPermission(userRole, 'canViewComplaints') && (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                            <MessageSquare className="text-violet-600" size={20} />
                                            Support Tickets
                                        </h2>
                                        <div className="space-y-4">
                                            {firstActiveComplaint ? (
                                                <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/30">
                                                    <div className="font-bold mb-1">{firstActiveComplaint.subject}</div>
                                                    <div className="text-xs text-slate-500 mb-3">#{`TK-${firstActiveComplaint.id}`} • {firstActiveComplaint.status}</div>
                                                    <div className="flex justify-between items-center">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${firstActiveComplaint.status === 'investigating' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700' : firstActiveComplaint.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700'}`}>
                                                            {firstActiveComplaint.status === 'investigating' ? 'In Progress' : firstActiveComplaint.status === 'pending' ? 'Pending' : 'Resolved'}
                                                        </span>
                                                        <button onClick={() => router.push(`/dashboard/complaints/${firstActiveComplaint.id}`)} className="text-xs font-bold text-violet-600">View Thread →</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-slate-500">
                                                    No active support tickets.
                                                </div>
                                            )}
                                            {hasPermission(userRole, 'canManageComplaints') && (
                                                <button onClick={() => router.push('/dashboard/complaints/new')} className="w-full py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">Create New Ticket</button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* AI Advisory Panel */}
                        {(userRole === 'ADMIN' || userRole === 'OPERATOR') && (
                            <div className="mb-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-purple-50/20 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-sm">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                                    <Brain className="text-purple-600 animate-pulse" size={24} />
                                    AI Control Room Advisor
                                </h2>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* 1. Energy Advisor Card */}
                                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                    <Zap size={10} /> Energy Optimization
                                                </span>
                                                <span className="text-xs font-semibold text-slate-400">Rating: {energyAdvisory?.metrics?.efficiency_rating ?? '—'}</span>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <span className="text-xs text-slate-500 block">Specific Energy Index</span>
                                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                                    {energyAdvisory?.metrics?.specific_energy_kwh_per_m3 ?? '0.00'} <span className="text-xs font-medium text-slate-400">kWh/m³</span>
                                                </span>
                                            </div>

                                            {energyAdvisory?.recommendations && energyAdvisory.recommendations.length > 0 ? (
                                                <div className="space-y-2 mb-4">
                                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            {energyAdvisory.recommendations[0].title}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                                            {energyAdvisory.recommendations[0].description}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500 mb-4">No active optimization suggestions.</p>
                                            )}
                                        </div>
                                        
                                        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
                                            <span className="text-slate-500">Est. Savings:</span>
                                            <span className="font-bold text-emerald-600">
                                                + {energyAdvisory?.estimated_monthly_savings_etb ?? '0.00'} ETB/mo
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. Equipment Health Score Card */}
                                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                                <HeartPulse size={10} /> Equipment Health
                                            </span>
                                            <span className="text-xs font-semibold text-slate-400">{equipmentHealthList.length} Assets</span>
                                        </div>
                                        
                                        <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
                                            {equipmentHealthList.length === 0 ? (
                                                <p className="text-xs text-slate-500 py-4 text-center">Syncing health records...</p>
                                            ) : (
                                                equipmentHealthList.slice(0, 3).map((eq, idx) => (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{eq.equipment_type.replace('_', ' ')}</span>
                                                            <span className={`font-mono font-bold ${
                                                                eq.health_score >= 0.8 ? 'text-green-500' : eq.health_score >= 0.6 ? 'text-amber-500' : 'text-red-500'
                                                            }`}>
                                                                {(eq.health_score * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${
                                                                    eq.health_score >= 0.8 ? 'bg-green-500' : eq.health_score >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                                                                }`}
                                                                style={{ width: `${eq.health_score * 100}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Predictive Maintenance Alert Card */}
                                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                    <Wrench size={10} /> Maintenance Alerts
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                                                    maintenanceAlertsList.length > 0 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {maintenanceAlertsList.length} Active
                                                </span>
                                            </div>

                                            {maintenanceAlertsList.length > 0 ? (
                                                <div className="space-y-2">
                                                    <div className="p-2.5 rounded-xl border border-red-100 dark:border-red-955 bg-red-50/30 dark:bg-red-950/10">
                                                        <div className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                                                            <AlertTriangle size={11} /> {maintenanceAlertsList[0].equipment_type.toUpperCase()} alert
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-1 leading-normal font-sans">
                                                            {maintenanceAlertsList[0].message}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-1.5 font-semibold">
                                                            Action: {maintenanceAlertsList[0].recommended_action}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                                    All assets operating normally.
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => router.push('/dashboard/ai-insights')} 
                                            className="w-full py-1.5 mt-3 text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-all"
                                        >
                                            View Full AI Insights →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800 transition-colors duration-500">
                                <div className="flex items-center justify-between gap-4 mb-5">
                                    <div>
                                        <h2 className="text-xl font-semibold dark:text-white">Water Flow History (Live)</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Main pipe flow trend, refreshed every 5 seconds
                                        </p>
                                    </div>
                                    <span className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        Engine Linked
                                    </span>
                                </div>

                                {/* Industrial KPI Analytics Bar */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Peak Flow</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{kpiSummary?.flow_peak ?? '—'}</div>
                                        <div className="text-[10px] text-slate-400">L/min</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Average</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{kpiSummary?.flow_avg ?? '—'}</div>
                                        <div className="text-[10px] text-slate-400">L/min</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Water Balance</div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{kpiSummary?.water_balance ?? '—'}</div>
                                        <div className="text-[10px] text-slate-400">24h delta</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Quality</div>
                                        <div className="text-lg font-bold text-emerald-600">{kpiSummary?.quality_pct != null ? `${kpiSummary.quality_pct}%` : '—'}</div>
                                        <div className="text-[10px] text-slate-400">{kpiSummary?.pump_running ? 'Pump Running' : 'Pump Idle'}</div>
                                    </div>
                                </div>

                                {/* Chart */}
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                            <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1e293b',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    color: '#fff',
                                                }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="value" 
                                                stroke="#3b82f6" 
                                                strokeWidth={3} 
                                                dot={false}
                                                activeDot={{ r: 6, fill: '#3b82f6' }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Data Quality Log */}
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800 transition-colors duration-500">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-lg font-semibold dark:text-white">Recent Readings</h2>
                                    <select 
                                        className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                                        value={qualityFilter}
                                        onChange={(e) => setQualityFilter(e.target.value as 'all' | 'good' | 'bad')}
                                    >
                                        <option value="all">All Quality</option>
                                        <option value="good">Good Only</option>
                                        <option value="bad">Bad Only</option>
                                    </select>
                                </div>

                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {chartData
                                        .filter(item => {
                                            if (qualityFilter === 'all') return true;
                                            if (qualityFilter === 'good') return item.original?.quality_code === 'good';
                                            if (qualityFilter === 'bad') return item.original?.quality_code !== 'good';
                                            return true;
                                        })
                                        .slice(0, 10)
                                        .map((item, index) => (
                                            <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.time}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                        item.original?.quality_code === 'good' 
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                        {item.original?.quality_code || 'unknown'}
                                                    </span>
                                                </div>
                                                <div className="text-lg font-bold text-slate-900 dark:text-white">{item.value.toFixed(2)} <span className="text-xs font-normal text-slate-500">L/min</span></div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </PageTransition>
    );
}

function MiniInsight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
        </div>
    );
}