"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";
import api from "@/lib/api";
import { PageTransition } from "@/components/PageTransition";

export default function NewComplaintPage() {
  const router = useRouter();
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post("complaints/", form);
      router.push(`/dashboard/complaints?complaintId=${res.data.id}`);
    } catch {
      setError("Failed to submit ticket. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Back navigation */}
        <button
          onClick={() => router.push("/dashboard/complaints")}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Support Center
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">New Support Ticket</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Describe your issue and our team will get back to you.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border dark:border-slate-800 transition-all duration-500">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500 dark:text-red-400 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Subject */}
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Power outage in Zone B"
                className="w-full p-3.5 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Priority <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-2">
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white outline-none appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                >
                  <option value="low">Low — General inquiry</option>
                  <option value="medium">Medium — Issue affecting service</option>
                  <option value="high">High — Critical issue</option>
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={18}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={8}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the issue in detail — what happened, when, and which area is affected..."
                className="w-full p-3.5 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all text-sm leading-relaxed"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-3.5 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Submit Ticket
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/complaints")}
                className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-xl flex items-start gap-3">
          <CheckCircle2 size={18} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            After submission you&apos;ll be redirected to your ticket in the Support Center where you can track its status.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
