"use client";
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await api.post('auth/login/', form);
            localStorage.setItem('token', res.data.access);
            router.push('/dashboard');
        } catch {
            alert("Invalid credentials");
        } finally {
            setIsLoading(false);
        }
    };

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
                        <div className="relative">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full p-4 pr-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                placeholder="Enter your password"
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
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

                    <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                        Don&apos;t have an account? <Link href="/register" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Create Account</Link>
                    </p>
                </form>
            </PageTransition>

            {/* Aesthetic background elements */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute top-24 right-24 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
    );
}
