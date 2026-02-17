"use client";
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    role: 'customer',
    phone_number: '' 
  });
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('auth/register/', form);
      alert("Account created! Please login.");
      router.push('/login');
    } catch {
      alert("Registration failed. Try a different username.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={handleRegister} className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border">
        <h1 className="text-2xl font-bold mb-2 text-blue-600">Join Kora Control</h1>
        <p className="text-slate-500 mb-6 text-sm">Create an account to manage your utilities.</p>
        
        <div className="space-y-4">
          <input 
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400" 
            placeholder="Username"
            onChange={(e) => setForm({...form, username: e.target.value})}
            required
          />
          <input 
            type="email"
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400" 
            placeholder="Email Address"
            onChange={(e) => setForm({...form, email: e.target.value})}
            required
          />
          <input 
            type="password" 
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400" 
            placeholder="Password"
            onChange={(e) => setForm({...form, password: e.target.value})}
            required
          />
          <input 
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400" 
            placeholder="Phone Number (optional)"
            onChange={(e) => setForm({...form, phone_number: e.target.value})}
          />
        </div>

        <button className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold mt-6 hover:bg-blue-700 transition-colors">
          Create Account
        </button>
        
        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login here</Link>
        </p>
      </form>
    </div>
  );
}

