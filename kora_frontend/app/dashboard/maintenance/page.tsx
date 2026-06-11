"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Plus,
  X,
  Filter,
  Wrench,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Trash2,
  Edit2,
  ChevronDown,
} from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { operationsApi, type MaintenanceTask } from "@/lib/api";
import { getUserRole } from "@/lib/permissions";

const STATUS_OPTIONS = ["pending", "in_progress", "completed", "cancelled"] as const;
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;

const priorityColor = (p: string) => {
  switch (p) {
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300";
    case "medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
    default: return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case "completed": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300";
    case "in_progress": return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300";
    case "cancelled": return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500";
    default: return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";
  }
};

const statusIcon = (s: string) => {
  switch (s) {
    case "completed": return <CheckCircle size={14} />;
    case "in_progress": return <Clock size={14} />;
    case "cancelled": return <X size={14} />;
    default: return <AlertTriangle size={14} />;
  }
};

const emptyForm = {
  title: "",
  description: "",
  priority: "medium" as MaintenanceTask["priority"],
  status: "pending",
  asset: null as number | null,
  assigned_to: null as number | null,
  planned_start: "",
  planned_end: "",
  notes: "",
};

export default function MaintenancePage() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = typeof window !== "undefined" ? getUserRole() : null;
  const canEdit = role === "ADMIN" || role === "OPERATOR";

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await operationsApi.getMaintenanceTasks();
      setTasks(res.data);
      setError(null);
    } catch (err) {
      console.error("Failed to load maintenance tasks:", err);
      setError("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (task: MaintenanceTask) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority || "medium",
      status: task.status,
      asset: task.asset,
      assigned_to: typeof task.assigned_to === "number" ? task.assigned_to : null,
      planned_start: task.planned_start ? task.planned_start.slice(0, 10) : "",
      planned_end: task.planned_end ? task.planned_end.slice(0, 10) : "",
      notes: task.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: form.status,
        notes: form.notes,
        planned_start: form.planned_start || null,
        planned_end: form.planned_end || null,
      };
      if (form.asset) payload.asset = form.asset;
      if (form.assigned_to) payload.assigned_to = form.assigned_to;

      if (editingId) {
        await operationsApi.updateMaintenanceTask(editingId, payload as Partial<MaintenanceTask>);
      } else {
        await operationsApi.createMaintenanceTask(payload as Partial<MaintenanceTask>);
      }
      setShowForm(false);
      await fetchTasks();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await operationsApi.deleteMaintenanceTask(id);
      await fetchTasks();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleStatusChange = async (task: MaintenanceTask, newStatus: string) => {
    try {
      await operationsApi.updateMaintenanceTask(task.id, { status: newStatus } as Partial<MaintenanceTask>);
      await fetchTasks();
    } catch (err) {
      console.error("Status update failed:", err);
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Maintenance Workorders</h1>
            <p className="text-slate-600 dark:text-slate-300">Track assigned tasks, schedules, and high-priority operations.</p>
          </div>
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus size={18} /> New Task
            </button>
          )}
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {(filterStatus || filterPriority) && (
            <button
              onClick={() => { setFilterStatus(""); setFilterPriority(""); }}
              className="text-sm text-blue-600 hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">
            {filtered.length} of {tasks.length} tasks
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Activity className="animate-spin text-blue-600" size={48} />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-10 text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button onClick={fetchTasks} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer">Retry</button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length > 0 ? (
              filtered.map((task) => (
                <div
                  key={task.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white truncate">{task.title}</h2>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityColor(task.priority)}`}>
                          {task.priority === "critical" && <AlertTriangle size={12} />}
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                        {task.asset_name && (
                          <span className="inline-flex items-center gap-1"><Wrench size={13} /> {task.asset_name}</span>
                        )}
                        {task.assigned_to_username && (
                          <span className="inline-flex items-center gap-1"><User size={13} /> {task.assigned_to_username}</span>
                        )}
                        {(task.planned_start || task.planned_end) && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={13} />
                            {task.planned_start ? new Date(task.planned_start).toLocaleDateString() : "?"}
                            {task.planned_end ? ` → ${new Date(task.planned_end).toLocaleDateString()}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <div className="relative group">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className={`appearance-none pl-7 pr-8 py-1.5 rounded-full text-xs font-semibold cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 ${statusColor(task.status)}`}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s.replace("_", " ")}</option>
                            ))}
                          </select>
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">{statusIcon(task.status)}</span>
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      )}
                      {!canEdit && (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusColor(task.status)}`}>
                          {statusIcon(task.status)}
                          {task.status.replace("_", " ")}
                        </span>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(task)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-600 cursor-pointer">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{task.description}</p>
                  )}
                  {task.notes && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Notes:</span> {task.notes}
                    </div>
                  )}
                  {task.completed_at && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      Completed {new Date(task.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-slate-500 dark:text-slate-400 shadow-sm">
                {filterStatus || filterPriority
                  ? "No tasks match the selected filters."
                  : "No maintenance tasks are currently scheduled."}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editingId ? "Edit Task" : "New Maintenance Task"}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Replace pump seals"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Describe the work required..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as MaintenanceTask["priority"] })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Planned Start</label>
                    <input
                      type="date"
                      value={form.planned_start}
                      onChange={(e) => setForm({ ...form, planned_start: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Planned End</label>
                    <input
                      type="date"
                      value={form.planned_end}
                      onChange={(e) => setForm({ ...form, planned_end: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
