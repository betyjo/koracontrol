"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, Clock, MessageSquarePlus,
  MessageSquare, Calendar, AlertTriangle, Filter, RefreshCw,
  ChevronDown, Edit, Trash2, X, Save, User, Shield, Users,
  ArrowUpDown, Search, Eye, Ban
} from 'lucide-react';
import api from '@/lib/api';
import { PageTransition } from '@/components/PageTransition';
import { getUserRole, UserRole } from '@/lib/permissions';

interface Complaint {
  id: number;
  user: string;
  subject: string;
  description: string;
  status: 'pending' | 'investigating' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  first_response_at?: string;
}

function ComplaintsInner() {
  const searchParams = useSearchParams();
  const complaintIdFocus = searchParams.get('complaintId');
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', description: '', priority: 'medium' });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);

  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
  }, []);

  const isAdmin = userRole === 'ADMIN';

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
    if (userRole) fetchComplaints();
  }, [userRole]);

  useEffect(() => {
    if (!complaintIdFocus || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`complaint-card-${complaintIdFocus}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-xl');
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'rounded-xl');
      }, 2600);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [complaintIdFocus, loading, complaints]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('complaints/', form);
      setForm({ subject: '', description: '', priority: 'medium' });
      await fetchComplaints();
      setSuccess("Ticket submitted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to submit ticket", err);
      setError("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (complaint: Complaint) => {
    setEditingId(complaint.id);
    setEditForm({ subject: complaint.subject, description: complaint.description, priority: complaint.priority });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ subject: '', description: '', priority: 'medium' });
  };

  const handleSaveEdit = async (id: number) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch(`complaints/${id}/`, editForm);
      setEditingId(null);
      await fetchComplaints();
      setSuccess("Ticket updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to update ticket", err);
      setError("Failed to update ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setStatusUpdatingId(id);
    setError(null);
    try {
      await api.patch(`complaints/${id}/`, { status: newStatus });
      await fetchComplaints();
      setSuccess(`Ticket #${id} status updated to ${newStatus}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to update status", err);
      setError("Failed to update ticket status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeleteConfirm = (id: number) => setShowDeleteConfirm(id);
  const handleDeleteCancel = () => setShowDeleteConfirm(null);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`complaints/${id}/`);
      setShowDeleteConfirm(null);
      await fetchComplaints();
      setSuccess("Ticket deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Failed to delete ticket", err);
      setError("Failed to delete ticket. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'investigating': return <Clock className="text-amber-500" size={16} />;
      default: return <AlertCircle className="text-slate-400" size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'investigating': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default: return 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
      default: return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterPriority !== 'all' && c.priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.subject.toLowerCase().includes(q) ||
             c.description.toLowerCase().includes(q) ||
             c.user?.toLowerCase().includes(q) ||
             `#${c.id}`.includes(q);
    }
    return true;
  });

  // Stats
  const totalComplaints = complaints.length;
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const investigatingCount = complaints.filter(c => c.status === 'investigating').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  const highPriorityCount = complaints.filter(c => c.priority === 'high' && c.status !== 'resolved').length;

  // Don't render until we know the role
  if (!userRole) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <RefreshCw size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">

        {/* ═══════════ ADMIN VIEW ═══════════ */}
        {isAdmin ? (
          <>
            {/* Header */}
            <div className="mb-8 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <Shield className="text-indigo-500 dark:text-indigo-400" size={28} />
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Complaint Management</h1>
                </div>
                <p className="text-slate-500 dark:text-slate-400">Manage and resolve all customer support tickets</p>
              </div>
              <button
                onClick={fetchComplaints}
                disabled={loading}
                className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Refresh"
              >
                <RefreshCw size={20} className={`text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <StatCard title="Total" value={totalComplaints} icon={<MessageSquare size={20} />} color="bg-blue-500" />
              <StatCard title="Pending" value={pendingCount} icon={<AlertCircle size={20} />} color="bg-slate-500" />
              <StatCard title="Investigating" value={investigatingCount} icon={<Clock size={20} />} color="bg-amber-500" />
              <StatCard title="Resolved" value={resolvedCount} icon={<CheckCircle2 size={20} />} color="bg-green-500" />
              <StatCard title="High Priority" value={highPriorityCount} icon={<AlertTriangle size={20} />} color="bg-red-500" />
            </div>

            {/* Toast */}
            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-800 mb-6 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tickets, users, or #ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white px-3 py-2 outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white px-3 py-2 outline-none"
                >
                  <option value="all">All Priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <span className="text-xs text-slate-400 ml-auto">{filteredComplaints.length} of {totalComplaints} tickets</span>
            </div>

            {/* Admin Ticket Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-hidden shadow-sm">
              {/* Table Header */}
              <div className="hidden md:grid md:grid-cols-[60px_1fr_120px_120px_120px_140px_100px] gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                <span>ID</span>
                <span>Ticket</span>
                <span>Customer</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Created</span>
                <span>Actions</span>
              </div>

              {loading ? (
                <div className="text-center py-16">
                  <RefreshCw size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-spin mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">Loading all tickets...</p>
                </div>
              ) : filteredComplaints.length === 0 ? (
                <div className="text-center py-16">
                  <MessageSquare size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No tickets found</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchQuery || filterStatus !== 'all' || filterPriority !== 'all'
                      ? 'No tickets match your filters.'
                      : 'No customer support tickets have been submitted yet.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y dark:divide-slate-800">
                  {filteredComplaints.map((ticket) => (
                    <div
                      key={ticket.id}
                      id={`complaint-card-${ticket.id}`}
                      className={`grid grid-cols-1 md:grid-cols-[60px_1fr_120px_120px_120px_140px_100px] gap-3 px-5 py-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                        complaintIdFocus === String(ticket.id) ? 'bg-blue-50/50 dark:bg-blue-950/25' : ''
                      } ${ticket.priority === 'high' && ticket.status !== 'resolved' ? 'border-l-4 border-l-red-500' : ''}`}
                    >
                      {/* ID */}
                      <span className="text-sm font-mono text-slate-400 dark:text-slate-500">#{ticket.id}</span>

                      {/* Ticket info */}
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{ticket.subject}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{ticket.description}</p>
                      </div>

                      {/* Customer */}
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{ticket.user || 'Unknown'}</span>
                      </div>

                      {/* Priority */}
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium capitalize w-fit ${getPriorityColor(ticket.priority)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(ticket.priority)}`} />
                        {ticket.priority}
                      </span>

                      {/* Status with admin dropdown */}
                      <div className="relative">
                        {statusUpdatingId === ticket.id ? (
                          <RefreshCw size={16} className="animate-spin text-blue-500" />
                        ) : (
                          <select
                            value={ticket.status}
                            onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1.5 rounded-lg border cursor-pointer outline-none appearance-none pr-6 transition-colors ${getStatusColor(ticket.status)}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        )}
                      </div>

                      {/* Date */}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewingId(viewingId === ticket.id ? null : ticket.id)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteConfirm(ticket.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete ticket"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Expanded detail view */}
                      {viewingId === ticket.id && (
                        <div className="md:col-span-7 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mt-2 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Full Description</span>
                              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">{ticket.description}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Timeline</span>
                              <div className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                                <p>Created: {new Date(ticket.created_at).toLocaleString()}</p>
                                <p>Updated: {new Date(ticket.updated_at).toLocaleString()}</p>
                                {ticket.first_response_at && (
                                  <p>First Response: {new Date(ticket.first_response_at).toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">SLA Status</span>
                              <div className="mt-1">
                                {!ticket.first_response_at && ticket.status !== 'resolved' ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <Clock size={12} /> Awaiting first response
                                  </span>
                                ) : ticket.status === 'resolved' ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle2 size={12} /> Resolved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                    <Clock size={12} /> In progress
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ═══════════ CUSTOMER VIEW ═══════════ */
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Support Center</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Submit tickets and track your support requests</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard title="Total Tickets" value={totalComplaints} icon={<MessageSquare size={20} />} color="bg-blue-500" />
              <StatCard title="Pending" value={pendingCount} icon={<AlertCircle size={20} />} color="bg-slate-500" />
              <StatCard title="Investigating" value={investigatingCount} icon={<Clock size={20} />} color="bg-amber-500" />
              <StatCard title="Resolved" value={resolvedCount} icon={<CheckCircle2 size={20} />} color="bg-green-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Submission Form */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border dark:border-slate-800 sticky top-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <MessageSquarePlus size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">New Support Ticket</h2>
                  </div>

                  {success && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-green-500" />
                      <span className="text-sm text-green-700 dark:text-green-300">{success}</span>
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                      <AlertTriangle size={18} className="text-red-500" />
                      <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
                      <input
                        required
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        placeholder="e.g. Power outage in Zone B"
                        className="w-full p-3 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
                      <div className="relative mt-1">
                        <select
                          value={form.priority}
                          onChange={(e) => setForm({ ...form, priority: e.target.value })}
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white outline-none appearance-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="low">Low - General inquiry</option>
                          <option value="medium">Medium - Issue affecting service</option>
                          <option value="high">High - Critical issue</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                      <textarea
                        required
                        rows={5}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe the issue in detail..."
                        className="w-full p-3 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {submitting ? (
                        <><RefreshCw size={18} className="animate-spin" />Submitting...</>
                      ) : (
                        <><MessageSquarePlus size={18} />Submit Ticket</>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Ticket List */}
              <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Your Support History</h2>
                  <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white px-3 py-2 outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <button onClick={fetchComplaints} disabled={loading}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer" title="Refresh">
                      <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-12">
                      <RefreshCw size={32} className="mx-auto text-slate-300 dark:text-slate-700 animate-spin mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">Loading tickets...</p>
                    </div>
                  ) : filteredComplaints.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <MessageSquare size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
                      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No tickets found</h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        {filterStatus === 'all' ? "You haven't submitted any support tickets yet." : `No ${filterStatus} tickets found.`}
                      </p>
                    </div>
                  ) : (
                    filteredComplaints.map((ticket) => (
                      <div key={ticket.id} id={`complaint-card-${ticket.id}`}
                        className={`bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all ${
                          complaintIdFocus === String(ticket.id) ? 'bg-blue-50/50 dark:bg-blue-950/25' : ''}`}>
                        {editingId === ticket.id ? (
                          <div className="space-y-4">
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-semibold text-slate-800 dark:text-white text-lg">Edit Ticket</h3>
                              <button onClick={handleCancelEdit} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={18} /></button>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Subject</label>
                              <input type="text" value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Priority</label>
                              <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Description</label>
                              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4}
                                className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <button onClick={() => handleSaveEdit(ticket.id)} disabled={submitting}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-2 cursor-pointer">
                                <Save size={16} />{submitting ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button onClick={handleCancelEdit} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-semibold text-slate-800 dark:text-white text-lg">{ticket.subject}</h3>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(ticket)} className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteConfirm(ticket.id)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                                  {getStatusIcon(ticket.status)}{ticket.status}
                                </div>
                              </div>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">{ticket.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <span className={`px-2 py-1 rounded font-medium uppercase ${getPriorityColor(ticket.priority)}`}>{ticket.priority} Priority</span>
                              <span className="flex items-center gap-1"><Calendar size={14} />Submitted: {new Date(ticket.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              {ticket.updated_at !== ticket.created_at && (
                                <span className="flex items-center gap-1"><Clock size={14} />Updated: {new Date(ticket.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Modal (shared) */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Delete Ticket</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete this support ticket? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={handleDeleteCancel} disabled={deletingId === showDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer">Cancel</button>
                <button onClick={() => handleDelete(showDeleteConfirm)} disabled={deletingId === showDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-slate-300 flex items-center justify-center gap-2 cursor-pointer">
                  <Trash2 size={16} />{deletingId === showDeleteConfirm ? 'Deleting...' : 'Delete Ticket'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

export default function ComplaintsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64 p-6">
        <RefreshCw size={28} className="animate-spin text-blue-600" />
      </div>
    }>
      <ComplaintsInner />
    </Suspense>
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
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border dark:border-slate-800 flex items-center gap-4 transition-all duration-300">
      <div className={`p-3 rounded-lg ${color} text-white shadow-lg shadow-blue-500/10`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
