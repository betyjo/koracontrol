"use client";
import { useEffect, useState } from 'react';
import { Bell, Mail, Phone, Webhook, X, Plus, Trash2 } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import api from '@/lib/api';

interface Notification {
  id: number;
  category: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface Subscription {
  id: number;
  channel: 'email' | 'sms' | 'webhook';
  destination: string;
  notify_alarm_critical: boolean;
  notify_complaint_sla: boolean;
  is_active: boolean;
  created_at: string;
}

export default function NotificationCenterPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState<'notifications' | 'subscriptions'>('notifications');
  const [loading, setLoading] = useState(false);
  const [showNewSubscription, setShowNewSubscription] = useState(false);
  const [newSub, setNewSub] = useState({
    channel: 'email' as 'email' | 'sms' | 'webhook',
    destination: '',
    notify_alarm_critical: true,
    notify_complaint_sla: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [notifRes, subRes] = await Promise.all([
        api.get('/notifications/'),
        api.get('/notifications/subscriptions/'),
      ]);
      setNotifications(notifRes.data || []);
      setSubscriptions(subRes.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const markNotificationRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      setNotifications(
        notifications.map(n => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read/');
      setNotifications(
        notifications.map(n => ({ ...n, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const createSubscription = async () => {
    if (!newSub.destination.trim()) {
      alert('Please enter a destination');
      return;
    }

    try {
      const res = await api.post('/notifications/subscriptions/', newSub);
      setSubscriptions([...subscriptions, res.data]);
      setNewSub({
        channel: 'email',
        destination: '',
        notify_alarm_critical: true,
        notify_complaint_sla: true,
      });
      setShowNewSubscription(false);
    } catch (err: unknown) {
      console.error('Failed to create subscription:', err);
      const error = err as { response?: { data?: { destination?: string[] } } };
      alert(error.response?.data?.destination?.[0] || 'Failed to create subscription');
    }
  };

  const deleteSubscription = async (id: number) => {
    if (!confirm('Delete this subscription?')) return;

    try {
      await api.delete(`/notifications/subscriptions/${id}/`);
      setSubscriptions(subscriptions.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete subscription:', err);
    }
  };

  const toggleSubscription = async (id: number, updates: Partial<Subscription>) => {
    try {
      const res = await api.patch(`/notifications/subscriptions/${id}/`, updates);
      setSubscriptions(
        subscriptions.map(s => (s.id === id ? { ...s, ...res.data } : s))
      );
    } catch (err) {
      console.error('Failed to update subscription:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="text-blue-600" size={20} />;
      case 'sms':
        return <Phone className="text-green-600" size={20} />;
      case 'webhook':
        return <Webhook className="text-purple-600" size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'alarm_critical':
        return <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs rounded font-medium">Critical Alarm</span>;
      case 'complaint_sla':
        return <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded font-medium">SLA Breach</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-xs rounded font-medium">{category}</span>;
    }
  };

  return (
    <PageTransition>
      <div className="p-6 max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Bell size={32} />
                Notifications
              </h1>
              <p className="text-slate-600 dark:text-slate-300">
                Manage in-app alerts and configure delivery channels
              </p>
            </div>
            {unreadCount > 0 && (
              <div className="text-right">
                <div className="text-4xl font-bold text-blue-600">{unreadCount}</div>
                <p className="text-sm text-slate-600 dark:text-slate-400">unread</p>
              </div>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            In-App Notifications
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`pb-4 px-2 font-medium transition-colors ${
              activeTab === 'subscriptions'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            Subscriptions
          </button>
        </div>

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div>
            {unreadCount > 0 && (
              <div className="mb-4">
                <button
                  onClick={markAllRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Mark all as read
                </button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                No notifications yet
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-lg border transition-opacity cursor-pointer ${
                      notif.read_at
                        ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 opacity-60'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}
                    onClick={() => !notif.read_at && markNotificationRead(notif.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getCategoryBadge(notif.category)}
                          {!notif.read_at && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {notif.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                      {notif.body}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setShowNewSubscription(!showNewSubscription)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={18} />
                Add Channel
              </button>
            </div>

            {/* New Subscription Form */}
            {showNewSubscription && (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      {newSub.channel === 'email' && <Mail size={120} />}
                      {newSub.channel === 'sms' && <Phone size={120} />}
                      {newSub.channel === 'webhook' && <Webhook size={120} />}
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                      <Plus className="text-blue-600" size={28} />
                      Configure Channel
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Delivery Method</label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['email', 'sms', 'webhook'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => setNewSub({ ...newSub, channel: type })}
                                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                  newSub.channel === type 
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600' 
                                    : 'border-slate-100 dark:border-slate-700 hover:border-blue-200'
                                }`}
                              >
                                {type === 'email' && <Mail size={20} />}
                                {type === 'sms' && <Phone size={20} />}
                                {type === 'webhook' && <Webhook size={20} />}
                                <span className="text-[10px] font-bold uppercase">{type}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-500 uppercase mb-2">
                            {newSub.channel === 'email' && 'Email Address'}
                            {newSub.channel === 'sms' && 'Phone Number'}
                            {newSub.channel === 'webhook' && 'Target URL'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              newSub.channel === 'email'
                                ? 'operator@plant.com'
                                : newSub.channel === 'sms'
                                ? '+1234567890'
                                : 'https://api.opsgenie.com/v1/json/...'
                            }
                            value={newSub.destination}
                            onChange={(e) => setNewSub({ ...newSub, destination: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Alert Subscriptions</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={newSub.notify_alarm_critical}
                              onChange={(e) => setNewSub({ ...newSub, notify_alarm_critical: e.target.checked })}
                              className="w-5 h-5 rounded text-blue-600"
                            />
                            <div>
                              <div className="text-sm font-bold">Critical Alarms</div>
                              <div className="text-[10px] text-slate-400">High priority system incidents</div>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={newSub.notify_complaint_sla}
                              onChange={(e) => setNewSub({ ...newSub, notify_complaint_sla: e.target.checked })}
                              className="w-5 h-5 rounded text-blue-600"
                            />
                            <div>
                              <div className="text-sm font-bold">SLA Breaches</div>
                              <div className="text-[10px] text-slate-400">Response time violations</div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setShowNewSubscription(false)}
                        className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createSubscription}
                        className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                      >
                        Activate Channel
                      </button>
                    </div>
                  </div>
            )}

            {/* Subscriptions List */}
            {loading ? (
              <div className="text-center py-12">Loading subscriptions...</div>
            ) : subscriptions.length === 0 ? (
              <div className="text-center py-12 text-slate-600 dark:text-slate-400">
                No notification channels configured
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map(sub => (
                  <div
                    key={sub.id}
                    className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-5 flex-1">
                        <div className={`p-4 rounded-2xl ${
                          sub.channel === 'email' ? 'bg-blue-50 text-blue-600' :
                          sub.channel === 'sms' ? 'bg-green-50 text-green-600' :
                          'bg-purple-50 text-purple-600'
                        }`}>
                          {getChannelIcon(sub.channel)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold capitalize text-lg">
                              {sub.channel}
                            </h3>
                            {sub.is_active ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">ACTIVE</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">DISABLED</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mb-4 font-mono">
                            {sub.destination}
                          </p>
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer group/item">
                              <input
                                type="checkbox"
                                checked={sub.notify_alarm_critical}
                                onChange={(e) =>
                                  toggleSubscription(sub.id, {
                                    notify_alarm_critical: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-blue-600"
                              />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover/item:text-blue-600 transition-colors">Critical Alarms</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer group/item">
                              <input
                                type="checkbox"
                                checked={sub.notify_complaint_sla}
                                onChange={(e) =>
                                  toggleSubscription(sub.id, {
                                    notify_complaint_sla: e.target.checked,
                                  })
                                }
                                className="w-4 h-4 rounded text-blue-600"
                              />
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover/item:text-blue-600 transition-colors">SLA Breaches</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Toggle</span>
                          <button
                            onClick={() => toggleSubscription(sub.id, { is_active: !sub.is_active })}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${sub.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${sub.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <button
                          onClick={() => deleteSubscription(sub.id)}
                          className="flex items-center gap-2 text-red-500 hover:text-red-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
