"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3,
    Receipt,
    MessageSquare,
    Bot,
    LogOut,
    Settings,
    User,
    Menu,
    X,
    Sun,
    Moon
} from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    const navItems = [
        { name: 'Monitoring', href: '/dashboard', icon: BarChart3 },
        { name: 'Billing', href: '/dashboard/billing', icon: Receipt },
        { name: 'Complaints', href: '/dashboard/complaints', icon: MessageSquare },
        { name: 'AI Assistant', href: '/dashboard/ai-chat', icon: Bot },
    ];

    const toggleDesktopSidebar = () => setIsDesktopSidebarOpen(!isDesktopSidebarOpen);
    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-500">
            {/* Collapsible Sidebar for Desktop */}
            <aside className={`hidden md:flex md:flex-col ${isDesktopSidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r dark:border-slate-800 shadow-sm transition-all duration-300`}>
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
                    {isDesktopSidebarOpen && (
                        <button 
                            onClick={toggleDesktopSidebar}
                            className="flex items-center gap-2 group"
                        >
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="text-white font-bold text-xl">K</span>
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                                Kora Control
                            </span>
                        </button>
                    )}
                    {!isDesktopSidebarOpen && (
                        <button 
                            onClick={toggleDesktopSidebar}
                            className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 group"
                        >
                            <span className="text-white font-bold text-xl">K</span>
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        {isDesktopSidebarOpen && <ThemeToggle />}
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${isDesktopSidebarOpen ? 'justify-start' : 'justify-center'} ${isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'
                                    }`}
                            >
                                <item.icon size={20} />
                                {isDesktopSidebarOpen && item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t dark:border-slate-800 space-y-1">
                    <button
                        onClick={handleLogout}
                        className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer ${isDesktopSidebarOpen ? 'justify-start' : 'justify-center'}`}
                    >
                        <LogOut size={20} />
                        {isDesktopSidebarOpen && 'Logout'}
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 md:hidden"
                    onClick={toggleMobileMenu}
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-800 shadow-xl transform transition-transform duration-300 md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">K</span>
                        </div>
                        <span className="text-xl font-bold dark:text-white">Kora Control</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button onClick={toggleMobileMenu} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <nav className="p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                                <Link
                                key={item.name}
                                href={item.href}
                                onClick={toggleMobileMenu}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${isActive
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-slate-600'
                                    }`}
                            >
                                <item.icon size={20} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t dark:border-slate-800 space-y-1">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top Navbar for Mobile */}
                <header className="md:hidden bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 py-4 flex justify-between items-center shrink-0 transition-colors duration-500">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">K</span>
                        </div>
                        <span className="text-lg font-bold dark:text-white">Kora Control</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button onClick={toggleMobileMenu} className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                            <Menu size={20} />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto focus:outline-none bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
                    {children}
                </main>
            </div>
        </div>
    );
}
