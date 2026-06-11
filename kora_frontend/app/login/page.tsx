"use client";
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { hasValidToken } from '@/lib/auth';
import { useGoogleLogin } from '@react-oauth/google';
import { getUserRole, getWelcomeMessage } from '@/lib/permissions';

export default function LoginPage() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    const handleGoogleCode = useCallback(async (code: string) => {
        setIsLoading(true);
        try {
            const res = await api.post('auth/google/', { code });
            const userRole = res.data.user?.role;
            if (userRole) {
                // All roles can log in via frontend with appropriate permissions
                const normalizedRole = getUserRole();
                const welcomeMsg = normalizedRole ? getWelcomeMessage(normalizedRole) : "Welcome";
                showToast(`${welcomeMsg}! Logged in successfully.`, "success");
            }
            localStorage.setItem('token', res.data.access);
            router.push('/dashboard');
        } catch (err: unknown) {
            let errorMsg = "Google authentication failed";
            if (axios.isAxiosError(err)) {
                errorMsg = err.response?.data?.error || errorMsg;
            }
            showToast(errorMsg, "error");
            setIsLoading(false);
        }
    }, [router, showToast]);

    useEffect(() => {
        if (hasValidToken()) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('authExpiredToastShown');
            }
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const decoded = JSON.parse(atob(parts[1]));
                        const role = (decoded.role || 'CUSTOMER').toLowerCase();
                        // All roles are allowed - dashboard handles role-based rendering
                    }
                } catch (err) {
                    console.error('Failed to decode token:', err);
                }
            }
            router.push('/dashboard');
            return;
        }

        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const error = urlParams.get('error');

            if (code) {
                // Clear URL params without refreshing
                window.history.replaceState({}, document.title, window.location.pathname);
                handleGoogleCode(code);
            } else if (error) {
                window.history.replaceState({}, document.title, window.location.pathname);
                showToast("Google authentication was cancelled or failed.", "error");
            }
        }
    }, [router, handleGoogleCode, showToast]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post('auth/login/', form);
            const userRole = res.data.user?.role;
            if (userRole) {
                // All roles can log in via frontend with appropriate permissions
                const normalizedRole = getUserRole();
                const welcomeMsg = normalizedRole ? getWelcomeMessage(normalizedRole) : "Welcome";
                showToast(`${welcomeMsg}! Logged in successfully.`, "success");
            }
            localStorage.setItem('token', res.data.access);
            router.push('/dashboard');
        } catch {
            showToast("Invalid credentials", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        flow: 'auth-code',
        ux_mode: 'redirect',
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/login',
    });

    const handleSocialLogin = (provider: string) => {
        if (provider === 'Google') {
            googleLogin();
        } else {
            showToast(`${provider} login is not yet configured.`, "info");
        }
    };

    const GoogleIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
    );

    const AppleIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.96.95-2.21 1.72-3.88 1.72-1.25 0-2.13-.58-3.17-.58-1.06 0-2.09.61-3.26.61-2.14 0-4.41-1.89-5.49-4.83-1.09-2.94-.32-6.15 1.72-8.1 1.04-1.01 2.39-1.58 3.7-1.58 1.22 0 2.22.56 3.26.56 1 0 1.95-.56 3.26-.56 1.04 0 2.03.35 2.85.93-2.15 1.25-1.78 4.22.44 5.28-.48 1.48-1.42 4.14-2.47 5.55zm-3.82-15.65c-.03 2.14-1.72 3.86-3.72 3.86-.03-2.22 1.83-4.14 3.72-3.86z"/>
        </svg>
    );

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative overflow-hidden">
            <div className="absolute top-8 right-8 z-50">
                <ThemeToggle />
            </div>

            <PageTransition>
                <form onSubmit={handleLogin} className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 transition-colors duration-500 relative z-10 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90">
                    <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Welcome Back</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in to your Kora Control account</p>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Username</label>
                            <input
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                placeholder="Enter your username"
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="w-full p-4 pr-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    placeholder="Enter your password"
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mb-6">
                        <Link href="/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-lg flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    <div className="my-6 flex items-center">
                        <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="px-4 text-sm text-slate-400 dark:text-slate-600">or continue with</span>
                        <div className="flex-1 border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => handleSocialLogin('Google')}
                            className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-medium text-slate-700 dark:text-slate-300"
                        >
                            <GoogleIcon />
                            Google
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSocialLogin('Apple')}
                            className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-medium text-slate-700 dark:text-slate-300"
                        >
                            <AppleIcon />
                            Apple
                        </button>
                    </div>

                    <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                            Sign up
                        </Link>
                    </p>
                </form>
            </PageTransition>
        </div>
    );
}