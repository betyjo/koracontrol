"use client";
import { FormEvent, useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Loader2 } from 'lucide-react';

function ForgotPasswordContent() {
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [uid, setUid] = useState('');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Auto-capture UID and Token from URL if present
    useEffect(() => {
        const urlUid = searchParams.get('uid');
        const urlToken = searchParams.get('token');
        if (urlUid) setUid(urlUid);
        if (urlToken) setToken(urlToken);
    }, [searchParams]);

    const handleRequestReset = async (e: FormEvent) => {
        e.preventDefault();
        setIsRequesting(true);
        try {
            const res = await api.post('auth/forgot-password/', { email });
            // Populate background fields
            if (res.data.uid) setUid(res.data.uid);
            if (res.data.token) setToken(res.data.token);
            
            showToast("Reset request submitted. Now enter your new password below.", "success");
        } catch {
            showToast("Unable to start password reset. Please try again.", "error");
        } finally {
            setIsRequesting(false);
        }
    };

    const handleResetPassword = async (e: FormEvent) => {
        e.preventDefault();
        if (!uid || !token) {
            showToast("Reset details missing. Please request a new reset link.", "error");
            return;
        }
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
            showToast("Password reset failed. The link may be expired.", "error");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 transition-colors duration-500 relative z-10 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Forgot Password</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    {!uid ? "Request a reset link for your account." : "Set your new account password."}
                </p>
            </div>

            {!uid ? (
                <form onSubmit={handleRequestReset} className="space-y-4 animate-in fade-in duration-500">
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
            ) : (
                <form onSubmit={handleResetPassword} className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
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
                    
                    <button 
                        type="button"
                        onClick={() => { setUid(''); setToken(''); }}
                        className="w-full text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                        Request a different link
                    </button>
                </form>
            )}

            <p className="text-center text-sm text-slate-600 dark:text-slate-400 pt-4">
                Remembered your password?{' '}
                <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                    Back to Login
                </Link>
            </p>
        </div>
    );
}

export default function ForgotPasswordPage() {
    return (
        <div className="flex min-h-screen items-start md:items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden px-4 pt-28 pb-10 md:py-10">
            <div className="absolute top-8 right-8 z-50">
                <ThemeToggle />
            </div>

            <PageTransition>
                <Suspense fallback={
                    <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 flex items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                }>
                    <ForgotPasswordContent />
                </Suspense>
            </PageTransition>
        </div>
    );
}

