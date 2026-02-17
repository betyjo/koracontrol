"use client";
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [form, setForm] = useState({ username: '', password: '' });
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('auth/login/', form);
            localStorage.setItem('token', res.data.access);
            router.push('/dashboard');
        } catch {
            alert("Invalid credentials");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <form onSubmit={handleLogin} className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
                <h1 className="text-2xl font-bold mb-6 text-blue-600">Kora Control Login</h1>
                <input
                    className="w-full p-3 mb-4 border rounded"
                    placeholder="Username"
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
                <input
                    type="password"
                    className="w-full p-3 mb-6 border rounded"
                    placeholder="Password"
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700">
                    Sign In
                </button>

                <p className="mt-4 text-center text-sm text-slate-600">
                    Don&apos;t have an account? <Link href="/register" className="text-blue-600 hover:underline">Register here</Link>
                </p>
            </form>
        </div>
    );
}
