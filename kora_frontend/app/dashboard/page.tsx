"use client";
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, CreditCard, MessageSquare, Loader2 } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';

export default function Dashboard() {
    const [chartData, setChartData] = useState([]);
    const [stats, setStats] = useState({ usage: 0, bill: 0, tickets: 0 });
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
                    <h1 className="text-3xl font-bold dark:text-white">Kora Live Portal</h1>
                    <p className="text-slate-500 dark:text-slate-400">Real-time usage monitoring</p>
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
                            trend="+2.5%"
                        />
                        <StatCard
                            title="Estimated Bill"
                            value="ETB 1,250.00"
                            icon={<CreditCard className="text-green-500" />}
                            trend="Normal"
                        />
                        <StatCard
                            title="Support Tickets"
                            value={stats.tickets}
                            icon={<MessageSquare className="text-amber-500" />}
                            trend="None"
                        />
                    </div>
                )}

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border dark:border-slate-800 transition-colors duration-500">
                    <h2 className="text-xl font-semibold mb-4 dark:text-white">Consumption History (Live)</h2>
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

function StatCard({ title, value, icon, trend }: any) {
    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border dark:border-slate-800 flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:scale-[1.02]">
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
