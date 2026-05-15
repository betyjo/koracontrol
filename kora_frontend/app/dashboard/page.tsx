"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, CreditCard, MessageSquare, Loader2, Zap, Waves, ShieldCheck, BellRing } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import DashboardScadaSection from '@/components/dashboard-viz/DashboardScadaSection';

interface ChartPoint {
    time: string;
    value: number;
    original?: any;
}

interface Stats {
    usage: number;
    bill: number;
    tickets: number;
}

export default function Dashboard() {
    const [chartData, setChartData] = useState<ChartPoint[]>([]);
    const [stats, setStats] = useState<Stats>({ usage: 0, bill: 1250, tickets: 0 });
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<string>('CUSTOMER');
    const [searchQuery, setSearchQuery] = useState('');
    const [qualityFilter, setQualityFilter] = useState<'all' | 'good' | 'bad'>('all');

    const fetchData = async (isInitial = false) => {
        try {
            if (isInitial) setLoading(true);
            const logRes = await api.get('logs/');

            // Filter for Main_Consumption to ensure the chart is clean
            const filteredLogs = logRes.data.filter((l: any) => l.tag_name === 'Main_Consumption');
            
            const formattedData = filteredLogs.slice(0, 15).reverse().map((log: any) => ({
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

            const compRes = await api.get('complaints/');
            setStats(prev => ({ ...prev, tickets: compRes.data.length }));

        } catch (err: any) {
            console.error("Dashboard data fetch failed:", err);
        } finally {
            if (isInitial) setLoading(false);
        }
    };

    useEffect(() => {
        // Extract role from token
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const decoded = JSON.parse(atob(parts[1]));
                    setUserRole(decoded.role || 'CUSTOMER');
                }
            } catch (err) {
                console.error('Failed to decode token:', err);
            }
        }

        fetchData(true);
        const interval = setInterval(() => fetchData(false), 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <PageTransition>
            <div className="p-6 max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 md:p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    Kora Live Portal
                                </h1>
                                <p className="mt-2 text-slate-600 dark:text-slate-300">
                                    A live overview of your plant status and role-specific insights.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                                <MiniInsight
                                    icon={<Zap size={16} className="text-amber-500" />}
                                    label="Consumption"
                                    value={`${stats.usage} kWh`}
                                />
                                <MiniInsight
                                    icon={<Waves size={16} className="text-cyan-500" />}
                                    label="Reading Health"
                                    value={chartData.length > 0 ? "Stable" : "Syncing"}
                                />
                                <MiniInsight
                                    icon={<ShieldCheck size={16} className="text-emerald-500" />}
                                    label="System Status"
                                    value="Online"
                                />
                                <MiniInsight
                                    icon={<MessageSquare size={16} className="text-violet-500" />}
                                    label="Open Tickets"
                                    value={`${stats.tickets}`}
                                />
                            </div>
                        </div>
                    </div>
                </header>

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
                                    <div className="space-y-4">
                                        <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                            <div className="text-xs font-bold text-red-600 mb-1 uppercase">Critical</div>
                                            <div className="text-sm font-bold">Tank B1 High Pressure</div>
                                            <div className="text-[10px] text-slate-500">2 mins ago</div>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                            <div className="text-xs font-bold text-amber-600 mb-1 uppercase">Warning</div>
                                            <div className="text-sm font-bold">Pump P1 Vibration</div>
                                            <div className="text-[10px] text-slate-500">14 mins ago</div>
                                        </div>
                                        <button className="w-full py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all">View All Alarms</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {userRole === 'CUSTOMER' && (
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
                                        <button className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20">Pay Now</button>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Last Payment</span>
                                            <span className="font-medium">$850.00 (Mar 12)</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-500">Next Billing Date</span>
                                            <span className="font-medium">Apr 12, 2024</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <MessageSquare className="text-violet-600" size={20} />
                                        Support Tickets
                                    </h2>
                                    <div className="space-y-4">
                                        {stats.tickets > 0 ? (
                                            <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl border border-violet-100 dark:border-violet-900/30">
                                                <div className="font-bold mb-1">Meter calibration issue</div>
                                                <div className="text-xs text-slate-500 mb-3">#TK-9283 • Open</div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">In Progress</span>
                                                    <button className="text-xs font-bold text-violet-600">View Thread →</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-slate-500">
                                                No active support tickets.
                                            </div>
                                        )}
                                        <button className="w-full py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-sm font-bold hover:bg-slate-100 transition-all">Create New Ticket</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800 transition-colors duration-500">
                                <div className="flex items-center justify-between gap-4 mb-5">
                                    <div>
                                        <h2 className="text-xl font-semibold dark:text-white">Consumption History (Live)</h2>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                            Main power usage trend, refreshed every 5 seconds
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
                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Peak Demand</div>
                                        <div className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                                            {chartData.length > 0 ? Math.max(...chartData.map(d => d.value)).toFixed(2) : '0.00'}
                                            <span className="text-[10px] ml-1 opacity-60">kWh</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg. Usage</div>
                                        <div className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                                            {chartData.length > 0 ? (chartData.reduce((acc, d) => acc + d.value, 0) / chartData.length).toFixed(2) : '0.00'}
                                            <span className="text-[10px] ml-1 opacity-60">kWh</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Trend Delta</div>
                                        <div className={`text-lg font-mono font-bold flex items-center gap-1 ${
                                            chartData.length > 1 && chartData[0].value > chartData[1].value ? 'text-rose-500' : 'text-emerald-500'
                                        }`}>
                                            {chartData.length > 1 ? (chartData[0].value - chartData[1].value).toFixed(2) : '0.00'}
                                            {chartData.length > 1 && (chartData[0].value > chartData[1].value ? <Activity size={14} /> : <Activity size={14} className="rotate-180" />)}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">SCADA Status</div>
                                        <div className={`text-sm font-bold flex items-center gap-1.5 ${
                                            chartData.length > 0 && chartData[0].value > 450 ? 'text-amber-500' : 'text-emerald-500'
                                        }`}>
                                            <div className={`w-2 h-2 rounded-full ${
                                                chartData.length > 0 && chartData[0].value > 450 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                            }`} />
                                            {chartData.length > 0 && chartData[0].value > 450 ? 'HIGH LOAD' : 'NORMAL'}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-80 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800" />
                                                <XAxis
                                                    dataKey="time"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="value"
                                                    stroke="#2563eb"
                                                    strokeWidth={4}
                                                    dot={{ r: 0 }}
                                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-slate-400">
                                            Waiting for 'Main_Consumption' data from Industrial Engine...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Activity size={18} className="text-blue-600" />
                                    Live Data Reader
                                </h3>

                                {/* Search and Filter Controls */}
                                <div className="flex flex-col gap-3 mb-4">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            placeholder="Search by value or time..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        />
                                        <Activity size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    </div>
                                    <div className="flex gap-2">
                                        {(['all', 'good', 'bad'] as const).map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => setQualityFilter(q)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                                    qualityFilter === q 
                                                    ? 'bg-blue-600 border-blue-600 text-white' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400'
                                                }`}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {chartData.filter(point => {
                                        const matchesSearch = point.value.toString().includes(searchQuery) || point.time.includes(searchQuery);
                                        const matchesQuality = qualityFilter === 'all' || point.original?.quality_code === qualityFilter;
                                        return matchesSearch && matchesQuality;
                                    }).length > 0 ? (
                                        chartData
                                            .filter(point => {
                                                const matchesSearch = point.value.toString().includes(searchQuery) || point.time.includes(searchQuery);
                                                const matchesQuality = qualityFilter === 'all' || point.original?.quality_code === qualityFilter;
                                                return matchesSearch && matchesQuality;
                                            })
                                            .map((point, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 transition-all hover:border-blue-300">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-500 font-mono">{point.time}</span>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">Consumption Reading</span>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{point.value}</span>
                                                        <span className="text-[10px] text-slate-400">kWh</span>
                                                    </div>
                                                    <div className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                        point.original?.quality_code === 'good' 
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                    }`}>
                                                        Quality: {point.original?.quality_code || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-slate-500 text-sm italic">
                                            No matches found.
                                        </div>
                                    )}
                                </div>
                                <button 
                                    onClick={() => {
                                        fetchData(true);
                                        setSearchQuery('');
                                        setQualityFilter('all');
                                    }}
                                    className="w-full mt-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-bold hover:bg-blue-50 hover:text-blue-600 transition-all"
                                >
                                    Clear & Refresh
                                </button>
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
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
        </div>
    );
}
