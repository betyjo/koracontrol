"use client";

import { useEffect, useState } from 'react';
import { 
  AlertCircle, CheckCircle2, Clock, MessageSquarePlus, 
  MessageSquare, Calendar, AlertTriangle, Filter, RefreshCw,
  ChevronDown, X
} from 'lucide-react';
import api from '@/lib/api';

interface Complaint {
  id: number;
  subject: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Load existing complaints
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('complaints/');
      setComplaints(res.data);
    } catch (err) {
      console.error("Failed to load complaints", err);
      setError("Failed to load complaints. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post('complaints/', form);
      setForm({ subject: '', description: '', priority: 'medium' });
      await fetchComplaints(); // Refresh list
      setSuccess("Ticket submitted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to submit ticket", err);
      setError("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'investigating': return <Clock className="text-amber-500" size={18} />;
      default: return <AlertCircle className="text-slate-400" size={18} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-50 text-green-700 border-green-200';
      case 'investigating': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  // Filter complaints
  const filteredComplaints = filterStatus === 'all' 
    ? complaints 
    : complaints.filter(c => c.status === filterStatus);

  // Calculate stats
  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const investigatingCount = complaints.filter(c => c.status === 'investigating').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Support Center</h1>
        <p className="text-slate-500 mt-1">Submit tickets and track your support requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Total Tickets"
          value={totalComplaints}
          icon={<MessageSquare size={20} />}
          color="bg-blue-500"
        />
        <StatCard 
          title="Pending"
          value={pendingCount}
          icon={<AlertCircle size={20} />}
          color="bg-slate-500"
        />
        <StatCard 
          title="Investigating"
          value={investigatingCount}
          icon={<Clock size={20} />}
          color="bg-amber-500"
        />
        <StatCard 
          title="Resolved"
          value={resolvedCount}
          icon={<CheckCircle2 size={20} />}
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Submission Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquarePlus size={20} className="text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">New Support Ticket</h2>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-sm text-green-700">{success}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Subject</label>
                <input 
                  required
                  value={form.subject}
                  onChange={(e) => setForm({...form, subject: e.target.value})}
                  placeholder="e.g. Power outage in Zone B"
                  className="w-full p-3 mt-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700">Priority</label>
                <div className="relative mt-1">
                  <select 
                    value={form.priority}
                    onChange={(e) => setForm({...form, priority: e.target.value})}
                    className="w-full p-3 border border-slate-200 rounded-lg outline-none appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="low">Low - General inquiry</option>
                    <option value="medium">Medium - Issue affecting service</option>
                    <option value="high">High - Critical issue</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  required
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  placeholder="Describe the issue in detail..."
                  className="w-full p-3 mt-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <MessageSquarePlus size={18} />
                    Submit Ticket
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Ticket List */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-800">Your Support History</h2>
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
              <button
                onClick={fetchComplaints}
                disabled={loading}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw size={32} className="mx-auto text-slate-300 animate-spin mb-4" />
                <p className="text-slate-500">Loading tickets...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                <MessageSquare size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">No tickets found</h3>
                <p className="text-slate-500">
                  {filterStatus === 'all' 
                    ? "You haven't submitted any support tickets yet." 
                    : `No ${filterStatus} tickets found.`}
                </p>
              </div>
            ) : (
              filteredComplaints.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-slate-800 text-lg">{ticket.subject}</h3>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status}
                    </div>
                  </div>
                  
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    {ticket.description}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span className={`px-2 py-1 rounded font-medium uppercase ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority} Priority
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      Submitted: {new Date(ticket.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {ticket.updated_at !== ticket.created_at && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Updated: {new Date(ticket.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color} text-white`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
