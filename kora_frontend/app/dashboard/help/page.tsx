"use client";
import React from 'react';
import { PageTransition } from '@/components/PageTransition';
import { 
    BarChart3,
    TrendingUp,
    Building2,
    BookOpen,
    BellRing,
    Receipt,
    MessageSquare,
    Bot,
    Sparkles,
    Bell,
    Settings,
    HelpCircle,
} from 'lucide-react';

interface HelpSection {
    icon: React.ComponentType<{ size?: number }>;
    title: string;
    path: string;
    description: string;
    usage: string[];
}

const helpSections: HelpSection[] = [
    {
        icon: BarChart3,
        title: 'Monitoring',
        path: '/dashboard',
        description: 'Real-time overview of your plant status and operational metrics. View live flow rates, system health, and current performance indicators.',
        usage: [
            'Monitor live flow rates and sensor readings',
            'Check system health status at a glance',
            'View quick insights and performance metrics',
            'Access real-time operational data'
        ]
    },
    {
        icon: TrendingUp,
        title: 'Trends',
        path: '/dashboard/trends',
        description: 'Analyze historical data patterns and trends. View charts and graphs to understand system performance over time.',
        usage: [
            'Examine historical data patterns',
            'Compare current vs. past performance',
            'Identify trends in flow rates and consumption',
            'Export trend data for reporting'
        ]
    },
    {
        icon: Building2,
        title: 'Plant Overview',
        path: '/dashboard/plant-overview',
        description: 'Comprehensive view of your entire plant infrastructure and operational layout.',
        usage: [
            'View complete plant infrastructure',
            'Monitor equipment status across the facility',
            'Access system-wide operational data',
            'Review plant performance metrics'
        ]
    },
    {
        icon: BookOpen,
        title: 'Journal',
        path: '/dashboard/journal',
        description: 'Access operational logs, event history, and system records. Track changes and maintain audit trails.',
        usage: [
            'Review system event history',
            'Access operational logs and records',
            'Track system changes and updates',
            'Maintain audit trails for compliance'
        ]
    },
    {
        icon: BellRing,
        title: 'Alarms',
        path: '/dashboard/alarms',
        description: 'Monitor and manage system alerts and alarms. View active, acknowledged, and historical alarm states.',
        usage: [
            'View active and historical alarms',
            'Acknowledge and resolve system alerts',
            'Filter alarms by severity or type',
            'Set up alarm notifications and preferences'
        ]
    },
    {
        icon: Receipt,
        title: 'Billing',
        path: '/dashboard/billing',
        description: 'View and manage your billing information, invoices, and payment history.',
        usage: [
            'View current billing statements',
            'Access payment history and invoices',
            'Update billing information',
            'Track consumption-based costs'
        ]
    },
    {
        icon: MessageSquare,
        title: 'Complaints',
        path: '/dashboard/complaints',
        description: 'Submit and track service complaints or requests. Communicate with support team regarding issues.',
        usage: [
            'Submit new complaints or service requests',
            'Track status of existing complaints',
            'View complaint history and resolutions',
            'Communicate directly with support team'
        ]
    },
    {
        icon: Bot,
        title: 'AI Assistant',
        path: '/dashboard/ai-chat',
        description: 'Interactive AI-powered assistant for system queries, operational guidance, and intelligent support.',
        usage: [
            'Ask questions about system operations',
            'Get intelligent operational guidance',
            'Request data analysis and insights',
            'Access AI-powered troubleshooting support'
        ]
    },
    {
        icon: Sparkles,
        title: 'AI Analytics',
        path: '/dashboard/analytics',
        description: 'Advanced AI-driven analytics and insights. Leverage machine learning for predictive analysis and optimization recommendations.',
        usage: [
            'View AI-powered system insights',
            'Access predictive maintenance recommendations',
            'Analyze performance optimization opportunities',
            'Review intelligent anomaly detection'
        ]
    },
    {
        icon: Bell,
        title: 'Notifications',
        path: '/dashboard/notifications',
        description: 'Manage your notification preferences and view system alerts, updates, and important messages.',
        usage: [
            'View recent notifications and alerts',
            'Configure notification preferences',
            'Set up custom alert rules',
            'Manage notification delivery methods'
        ]
    },
    {
        icon: Settings,
        title: 'Settings',
        path: '/dashboard/settings',
        description: 'Manage your account settings, profile information, security preferences, and application configurations.',
        usage: [
            'Update profile and contact information',
            'Change password and security settings',
            'Configure application preferences',
            'Manage account and privacy settings'
        ]
    }
];

export default function HelpPage() {
    return (
        <PageTransition>
            <div className="p-6 max-w-6xl mx-auto">
                <header className="mb-8">
                    <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                                <HelpCircle size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                                    Help Center
                                </h1>
                                <p className="mt-2 text-slate-600 dark:text-slate-300">
                                    Learn how to use each feature of the Kora Control dashboard
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="grid gap-6">
                    {helpSections.map((section, index) => (
                        <div 
                            key={index} 
                            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                        <section.icon size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                                {section.title}
                                            </h2>
                                            <span className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                {section.path}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {section.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                                    How to Use
                                </h3>
                                <ul className="space-y-2">
                                    {section.usage.map((item, itemIndex) => (
                                        <li key={itemIndex} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 shrink-0" />
                                            <span className="text-sm">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                            <HelpCircle size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                Need Additional Help?
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                If you need further assistance with any feature, please use the Complaints page to contact our support team. 
                                Our AI Assistant is also available 24/7 to answer your questions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
}