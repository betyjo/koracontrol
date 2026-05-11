"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, CreditCard, MessageSquare, Loader2, Zap, Waves, ShieldCheck } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

interface ChartPoint {
    time: string;
    value: number;
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const logRes = await api.get('logs/');

                const formattedData = logRes.data.slice(0, 10).reverse().map((log: any) => ({
                    time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    value: log.value
                }));

                setChartData(formattedData);

                if (logRes.data.length > 0) {
                    setStats(prev => ({ ...prev, usage: logRes.data[0].value }));
                }

                const compRes = await api.get('complaints/');
                setStats(prev => ({ ...prev, tickets: compRes.data.length }));

            } catch (err: any) {
                console.error("Dashboard data fetch failed:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // Auto-refresh every 5 seconds
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
                                    A live overview of your consumption, billing, and support activity.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                                <MiniInsight
                                    icon={<Zap size={16} className="text-amber-500" />}
                                    label="Current Load"
                                    value={`${stats.usage} units`}
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
                    <div className="flex items-center justify-center h-32 mb-8">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <StatCard
                            title="Live Reading"
                            value={`${stats.usage} units`}
                            icon={<Activity className="text-blue-500" />}
                            trend="Real-time"
                            accent="from-blue-500 to-indigo-500"
                        />
                        <StatCard
                            title="Estimated Bill"
                            value={`ETB ${stats.bill.toLocaleString()}.00`}
                            icon={<CreditCard className="text-green-500" />}
                            trend="Within range"
                            accent="from-emerald-500 to-teal-500"
                        />
                        <StatCard
                            title="Support Tickets"
                            value={stats.tickets}
                            icon={<MessageSquare className="text-amber-500" />}
                            trend={stats.tickets === 0 ? "No issues" : "Needs review"}
                            accent="from-amber-500 to-orange-500"
                        />
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border dark:border-slate-800 transition-colors duration-500">
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                            <h2 className="text-xl font-semibold dark:text-white">Consumption History (Live)</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Last 10 readings, refreshed every 5 seconds
                            </p>
                        </div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            Live
                        </span>
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
                                            backgroundColor: 'var(--card)',
                                            borderColor: 'var(--border)',
                                            borderRadius: '8px',
                                            color: 'var(--foreground)'
                                        }}
                                        itemStyle={{ color: '#2563eb' }}
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
                                Waiting for data from Industrial Engine...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}

function StatCard({
    title,
    value,
    icon,
    trend,
    accent,
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend: string;
    accent: string;
}) {
    return (
        <div className="relative bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border dark:border-slate-800 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
            <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${accent}`} />
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl transition-colors">{icon}</div>
            <div className="flex-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                    {trend && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            {trend}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function MiniInsight({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
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
