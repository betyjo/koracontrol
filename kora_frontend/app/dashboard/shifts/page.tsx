"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Download, LogIn, LogOut, Users, AlertTriangle, Activity, FileText } from "lucide-react";
import { PageTransition } from "@/components/PageTransition";
import { alarmApi, AlarmEvent } from "@/lib/api";

interface ShiftEvent {
  id: string;
  time: string;
  category: string;
  message: string;
}

interface Shift {
  id: string;
  type: "Morning" | "Afternoon" | "Night";
  operator: string;
  startTime: string;
  endTime: string | null;
  active: boolean;
  events: ShiftEvent[];
}

function detectShiftType(): "Morning" | "Afternoon" | "Night" {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Morning";
  if (h >= 14 && h < 22) return "Afternoon";
  return "Night";
}

export default function ShiftsPage() {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [operatorName, setOperatorName] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentAlarms, setRecentAlarms] = useState<AlarmEvent[]>([]);

  const startShift = useCallback(() => {
    if (!operatorName.trim()) return;
    const shift: Shift = {
      id: `shift-${Date.now()}`,
      type: detectShiftType(),
      operator: operatorName.trim(),
      startTime: new Date().toISOString(),
      endTime: null,
      active: true,
      events: [{ id: `ev-${Date.now()}`, time: new Date().toISOString(), category: "SHIFT", message: `Shift started by ${operatorName}` }],
    };
    setCurrentShift(shift);
    setOperatorName("");
  }, [operatorName]);

  const endShift = useCallback(() => {
    if (!currentShift) return;
    const ended: Shift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      active: false,
      events: [
        ...currentShift.events,
        { id: `ev-${Date.now()}`, time: new Date().toISOString(), category: "SHIFT", message: `Shift ended by ${currentShift.operator}` },
      ],
    };
    setShiftHistory((prev) => [ended, ...prev]);
    setCurrentShift(null);
    setHandoverNote("");
  }, [currentShift]);

  const addHandoverNote = useCallback(() => {
    if (!currentShift || !handoverNote.trim()) return;
    setCurrentShift({
      ...currentShift,
      events: [
        ...currentShift.events,
        { id: `ev-${Date.now()}`, time: new Date().toISOString(), category: "NOTE", message: handoverNote.trim() },
      ],
    });
    setHandoverNote("");
  }, [currentShift, handoverNote]);

  // Load recent alarms for current shift context
  useEffect(() => {
    alarmApi.listEvents({}).then((res) => {
      if (Array.isArray(res.data)) setRecentAlarms(res.data.slice(0, 10));
    }).catch(() => {});
  }, []);

  // Auto-log alarms during active shift
  useEffect(() => {
    if (!currentShift?.active) return;
    const interval = setInterval(() => {
      alarmApi.listEvents({}).then((res) => {
        if (!Array.isArray(res.data) || !currentShift) return;
        const newAlarms = res.data.filter((a) => {
          const t = a.triggered_at || "";
          return new Date(t).getTime() > new Date(currentShift.startTime).getTime();
        });
        setRecentAlarms(newAlarms.slice(0, 10));
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [currentShift]);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!currentShift?.startTime) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      const sec = Math.floor((Date.now() - new Date(currentShift.startTime).getTime()) / 1000);
      setElapsedSeconds(sec);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentShift?.startTime]);

  const shiftDuration = useMemo(() => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsedSeconds]);

  const exportReport = useCallback(() => {
    const shift = currentShift || shiftHistory[0];
    if (!shift) return;
    let report = `KORA SCADA SHIFT REPORT\n${"=".repeat(40)}\n`;
    report += `Shift: ${shift.type}\nOperator: ${shift.operator}\n`;
    report += `Start: ${new Date(shift.startTime).toLocaleString()}\n`;
    report += `End: ${shift.endTime ? new Date(shift.endTime).toLocaleString() : "Active"}\n`;
    report += `\nEVENT LOG\n${"-".repeat(40)}\n`;
    shift.events.forEach((ev) => {
      report += `[${new Date(ev.time).toLocaleTimeString()}] [${ev.category}] ${ev.message}\n`;
    });
    report += `\n--- End of Report ---\n`;
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift_report_${shift.type.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentShift, shiftHistory]);

  const shiftTypeColor = (type: string) => {
    if (type === "Morning") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (type === "Afternoon") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Shift Management</h1>
            <p className="text-slate-600 dark:text-slate-300">Operator shift handover, event tracking, and reporting.</p>
          </div>
          {(currentShift || shiftHistory.length > 0) && (
            <button onClick={exportReport} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold">
              <Download size={16} /> Export Report
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Shift Panel */}
          <div className="lg:col-span-2 space-y-6">
            {!currentShift ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Start New Shift</h2>
                <div className="flex gap-3">
                  <input
                    type="text" placeholder="Operator name" value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                  />
                  <button onClick={startShift} disabled={!operatorName.trim()} className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 text-sm font-semibold inline-flex items-center gap-2">
                    <LogIn size={16} /> Start Shift
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Current shift period: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${shiftTypeColor(detectShiftType())}`}>{detectShiftType()}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Active Shift</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Operator: <span className="font-semibold text-slate-700 dark:text-slate-200">{currentShift.operator}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${shiftTypeColor(currentShift.type)}`}>{currentShift.type}</span>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2 font-mono">{shiftDuration}</p>
                  </div>
                </div>

                {/* Handover Notes */}
                <div className="flex gap-2 mt-4">
                  <input
                    type="text" placeholder="Add handover note..." value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addHandoverNote()}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                  />
                  <button onClick={addHandoverNote} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700">Add</button>
                </div>

                {/* Event Log */}
                <div className="mt-5 space-y-2 max-h-80 overflow-y-auto">
                  {currentShift.events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap mt-0.5">
                        {new Date(ev.time).toLocaleTimeString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${ev.category === "SHIFT" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : ev.category === "ALARM" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                        {ev.category}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{ev.message}</span>
                    </div>
                  ))}
                </div>

                <button onClick={endShift} className="mt-5 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 text-sm font-semibold inline-flex items-center gap-2">
                  <LogOut size={16} /> End Shift
                </button>
              </div>
            )}

            {/* Shift History */}
            {shiftHistory.length > 0 && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Shift History</h2>
                <div className="space-y-3">
                  {shiftHistory.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${shiftTypeColor(s.type)}`}>{s.type}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.operator}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(s.startTime).toLocaleString()} — {s.endTime ? new Date(s.endTime).toLocaleTimeString() : "Active"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{s.events.length} events</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Shift Info Card */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Shift Schedule</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Morning", time: "06:00 — 14:00", color: "bg-amber-500" },
                  { label: "Afternoon", time: "14:00 — 22:00", color: "bg-blue-500" },
                  { label: "Night", time: "22:00 — 06:00", color: "bg-indigo-500" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{s.label}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-auto">{s.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Alarms During Shift */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" /> Recent Alarms
              </h3>
              {recentAlarms.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No recent alarms.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {recentAlarms.map((a) => (
                    <div key={a.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{a.message || a.rule_name || `Alarm #${a.id}`}</p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(a.triggered_at || "").toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
