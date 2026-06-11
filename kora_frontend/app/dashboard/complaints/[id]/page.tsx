"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { PageTransition } from '@/components/PageTransition';

interface Complaint {
  id: number;
  subject: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export default function ComplaintDetailPage() {
  const params = useParams() as { id?: string };
  const id = params?.id;
  const router = useRouter();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchComplaint = async () => {
      setComplaint(null);
      setError(null);
      setLoading(true);

      try {
        const res = await api.get(`complaints/${id}/`);
        if (cancelled) return;
        setComplaint(res.data);
      } catch (err) {
        console.error('Failed to load complaint', err);
        if (!cancelled) setError('Failed to load complaint.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchComplaint();

    return () => { cancelled = true; };
  }, [id]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'investigating': return <Clock className="text-amber-500" size={18} />;
      default: return <AlertCircle className="text-slate-400" size={18} />;
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/complaints')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300"
        >
          <ArrowLeft size={16} />
          Back to Complaints
        </button>

        {loading && (
          <div className="text-center py-12">
            <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-500 mt-3">Loading complaint...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {complaint && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border dark:border-slate-800 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{complaint.subject}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Submitted {new Date(complaint.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-full text-xs font-medium capitalize bg-slate-50 dark:bg-slate-800 border dark:border-slate-700">
                  {getStatusIcon(complaint.status)}
                  <span className="ml-2">{complaint.status}</span>
                </div>
              </div>
            </div>

            <div className="mb-6 text-slate-700 dark:text-slate-300 leading-relaxed">
              {complaint.description}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="px-2 py-1 rounded font-medium uppercase text-sm">Priority: {complaint.priority}</span>
              <span>Created: {new Date(complaint.created_at).toLocaleString()}</span>
              {complaint.updated_at !== complaint.created_at && (
                <span>Updated: {new Date(complaint.updated_at).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
