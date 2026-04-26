"use client";
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [uid, setUid] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleRequestReset = async (e: FormEvent) => {
        e.preventDefault();
        setIsRequesting(true);
        try {
            const res = await api.post('auth/forgot-password/', { email });
            setUid(res.data.uid || '');
            setToken(res.data.token || '');
            showToast("Reset request submitted. Continue below to set a new password.", "success");
        } catch {
            showToast("Unable to start password reset. Please try again.", "error");
        } finally {
            setIsRequesting(false);
        }
    };

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        setIsResetting(true);
        try {
            await api.post('auth/reset-password/', {
                uid,
                token,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            showToast("Password reset successful. Please sign in.", "success");
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            showToast("Password reset failed. Check the reset details and try again.", "error");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-start md:items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden px-4 pt-28 pb-10 md:py-10">
            <div className="absolute top-8 right-8 z-50">
                <ThemeToggle />
            </div>

            <PageTransition>
                <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 transition-colors duration-500 relative z-10 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 space-y-6">
                    <div>
                        <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Forgot Password</h1>
                        <p className="text-slate-500 dark:text-slate-400">Request a reset and set a new password.</p>
                    </div>

                    <form onSubmit={handleRequestReset} className="space-y-4">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your account email"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                        <button
                            type="submit"
                            disabled={isRequesting}
                            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all transform cursor-pointer flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isRequesting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Request Reset'}
                        </button>
                    </form>

                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Reset UID</label>
                        <input
                            required
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                            placeholder="UID from reset request"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />

                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Reset Token</label>
                        <input
                            required
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Token from reset request"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />

                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">New Password</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />

                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">Confirm Password</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />

                        <button
                            type="submit"
                            disabled={isResetting}
                            className="w-full bg-slate-900 dark:bg-slate-700 text-white p-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all transform cursor-pointer flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isResetting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset Password'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                        Remembered your password?{' '}
                        <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                            Back to Login
                        </Link>
                    </p>
                </div>
            </PageTransition>
        </div>
    );
}
