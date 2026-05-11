"use client";
import { useLayoutEffect, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { hasValidToken } from '@/lib/auth';
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    useLayoutEffect(() => {
        if (hasValidToken()) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('authExpiredToastShown');
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
    }, [router]);

    const handleGoogleCode = async (code: string) => {
        setIsLoading(true);
        try {
            const res = await api.post('auth/google/', { code });
            localStorage.setItem('token', res.data.access);
            showToast("Logged in with Google successfully!", "success");
            router.push('/dashboard');
        } catch (err: any) {
            const errorMsg = err.response?.data?.error || "Google authentication failed";
            showToast(errorMsg, "error");
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post('auth/login/', form);
            localStorage.setItem('token', res.data.access);
            showToast("Logged in successfully!", "success");
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
        redirect_uri: 'http://localhost:3000/login',
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

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all transform mb-6 cursor-pointer flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Signing In...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200 dark:border-slate-800"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-slate-900 px-4 text-slate-500 dark:text-slate-400 font-medium">Or continue with</span>
                        </div>
                    </div>

                    <div className="flex justify-center gap-6 mb-8">
                        <button 
                            type="button" 
                            onClick={() => handleSocialLogin('Google')}
                            className="w-12 h-12 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 group"
                        >
                            <GoogleIcon />
                        </button>
                        <button 
                            type="button" 
                            onClick={() => handleSocialLogin('Apple')}
                            className="w-12 h-12 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-95 text-slate-900 dark:text-white group"
                        >
                            <AppleIcon />
                        </button>
                    </div>

                    <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                        Don&apos;t have an account? <Link href="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Create Account</Link>
                    </p>
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Forgot your password? <Link href="/forgot-password" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Reset here</Link>
                    </p>
                </form>
            </PageTransition>

            {/* Aesthetic background elements */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute top-24 right-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
    );
}
