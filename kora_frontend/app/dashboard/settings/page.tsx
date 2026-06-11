"use client";
import React, { useState, useEffect } from 'react';
import { PageTransition } from '@/components/PageTransition';
import api from '@/lib/api';
import { 
    User, 
    Lock, 
    Trash2, 
    AlertTriangle, 
    Save, 
    Loader2, 
    ChevronRight,
    Mail,
    Phone,
    Shield
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'account'>('profile');
    const [profile, setProfile] = useState({ username: '', email: '', phone_number: '' });
    const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm_password: '' });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const { showToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('profile/');
                setProfile({
                    username: res.data.username || '',
                    email: res.data.email || '',
                    phone_number: res.data.phone_number || ''
                });
            } catch (err) {
                console.error("Failed to fetch profile", err);
            } finally {
                setInitialLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.patch('profile/', profile);
            showToast('Profile updated successfully!', 'success');
        } catch (err: unknown) {
            showToast('Failed to update profile.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new_password !== passwords.confirm_password) {
            showToast('Passwords do not match!', 'error');
            return;
        }
        setLoading(true);
        try {
            await api.post('profile/change-password/', {
                old_password: passwords.old_password,
                new_password: passwords.new_password
            });
            showToast('Password changed successfully!', 'success');
            setPasswords({ old_password: '', new_password: '', confirm_password: '' });
        } catch (err: unknown) {
            const errorMsg = (err as {
                response?: {
                    data?: { old_password?: string[] };
                };
            })?.response?.data?.old_password?.[0] || 'Failed to change password.';
            showToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            await api.delete('profile/delete/');
            localStorage.removeItem('token');
            showToast('Account deleted permanately.', 'info');
            router.push('/login');
        } catch (err) {
            showToast('Failed to delete account.', 'error');
            setShowDeleteModal(false);
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="p-6 max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold dark:text-white">Settings</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your profile, security, and account preferences</p>
                </header>

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Navigation Sidebar */}
                    <div className="w-full md:w-64 shrink-0">
                        <nav className="flex flex-row md:flex-col gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800 shadow-sm overflow-x-auto md:overflow-x-visible">
                            <TabButton 
                                active={activeTab === 'profile'} 
                                onClick={() => setActiveTab('profile')}
                                icon={<User size={18} />}
                                label="Profile"
                            />
                            <TabButton 
                                active={activeTab === 'security'} 
                                onClick={() => setActiveTab('security')}
                                icon={<Lock size={18} />}
                                label="Security"
                            />
                            <TabButton 
                                active={activeTab === 'account'} 
                                onClick={() => setActiveTab('account')}
                                icon={<Shield size={18} />}
                                label="Other Settings"
                            />
                        </nav>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-500">
                            {activeTab === 'profile' && (
                                <form onSubmit={handleProfileUpdate} className="p-8 space-y-6">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                                            <User size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold dark:text-white">Public Profile</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Update your basic information</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                <User size={14} /> Username
                                            </label>
                                            <input 
                                                value={profile.username}
                                                onChange={(e) => setProfile({...profile, username: e.target.value})}
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                placeholder="Username"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                <Mail size={14} /> Email Address
                                            </label>
                                            <input 
                                                type="email"
                                                value={profile.email}
                                                onChange={(e) => setProfile({...profile, email: e.target.value})}
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                placeholder="email@example.com"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                                                <Phone size={14} /> Phone Number
                                            </label>
                                            <input 
                                                value={profile.phone_number}
                                                onChange={(e) => setProfile({...profile, phone_number: e.target.value})}
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                placeholder="+251 ..."
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center gap-2 disabled:opacity-70 cursor-pointer"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'security' && (
                                <form onSubmit={handlePasswordChange} className="p-8 space-y-6">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
                                            <Lock size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold dark:text-white">Security Settings</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Manage your password and protection</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Password</label>
                                            <input 
                                                type="password"
                                                value={passwords.old_password}
                                                onChange={(e) => setPasswords({...passwords, old_password: e.target.value})}
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                placeholder="••••••••"
                                            />
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">New Password</label>
                                                <input 
                                                    type="password"
                                                    value={passwords.new_password}
                                                    onChange={(e) => setPasswords({...passwords, new_password: e.target.value})}
                                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                                                <input 
                                                    type="password"
                                                    value={passwords.confirm_password}
                                                    onChange={(e) => setPasswords({...passwords, confirm_password: e.target.value})}
                                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button 
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] flex items-center gap-2 disabled:opacity-70 cursor-pointer"
                                        >
                                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Shield size={20} />}
                                            Update Password
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'account' && (
                                <div className="p-8 space-y-8">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
                                            <Trash2 size={32} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold dark:text-white">Other Settings</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Account termination and data cleanup</p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-red-600 shadow-sm">
                                                <AlertTriangle size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-red-700 dark:text-red-400 mb-1">Delete Account Permanentely</h3>
                                                <p className="text-sm text-red-600/80 dark:text-red-400/60 mb-4">
                                                    Once you delete your account, there is no going back. All your monitoring history, bills, and data will be permanently removed from our infrastructure.
                                                </p>
                                                <button 
                                                    onClick={() => setShowDeleteModal(true)}
                                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-[0.98] cursor-pointer"
                                                >
                                                    Delete My Account
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer" 
                        onClick={() => setShowDeleteModal(false)}
                    />
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 shadow-2xl relative z-10 border dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 animate-bounce">
                                <AlertTriangle size={40} />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-center dark:text-white mb-2">Delete Permanately?</h3>
                        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">
                            Are you sure you want to delete permanately? This action cannot be undone and all your data will be cleared from Kora Control.
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={loading}
                                className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
                            >
                                {loading && <Loader2 size={18} className="animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageTransition>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group whitespace-nowrap md:whitespace-normal cursor-pointer ${
                active 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
        >
            <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`}>
                {icon}
            </span>
            {label}
            <ChevronRight size={14} className={`ml-auto transition-transform hidden md:block ${active ? 'translate-x-0' : '-translate-x-2 opacity-0'}`} />
        </button>
    );
}
