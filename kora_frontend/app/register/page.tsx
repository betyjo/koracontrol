"use client";
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageTransition } from '@/components/PageTransition';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'customer',
    phone_number: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('auth/register/', form);
      alert("Account created! Please login.");
      router.push('/login');
    } catch {
      alert("Registration failed. Try a different username.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-500 relative overflow-hidden">
      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      <PageTransition>
        <form onSubmit={handleRegister} className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 transition-colors duration-500 relative z-10 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90">
          <h1 className="text-3xl font-extrabold mb-2 text-slate-900 dark:text-white">Join Kora</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Create an account to manage your utilities.</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Username</label>
              <input
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="Choose a username"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Email Address</label>
              <input
                type="email"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="name@example.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Password</label>
              <input
                type="password"
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="Create a strong password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Phone Number</label>
              <input
                className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                placeholder="+251 ..."
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold mt-8 hover:bg-blue-700 shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all transform mb-6 cursor-pointer flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account? <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Login here</Link>
          </p>
        </form>
      </PageTransition>

      {/* Aesthetic background elements */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-24 left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
    </div>
  );
}
