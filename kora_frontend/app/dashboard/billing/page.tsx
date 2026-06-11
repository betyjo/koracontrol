"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Receipt,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Droplet,
  ArrowLeftRight,
} from "lucide-react";
import api, { dashboardKpiApi, type BillForecast, type UsageComparison, type ServiceOutage } from "@/lib/api";
import { PageTransition } from "@/components/PageTransition";
import { getUserRole, hasPermission, UserRole } from "@/lib/permissions";

interface Bill {
  id: number;
  amount: string;
  usage_kwh: number;
  is_paid: boolean;
  billing_date: string;
}

interface PaymentTransaction {
  id: number;
  tx_ref: string;
  bill_id: number;
  amount: string;
  status: string;
  created_at: string;
}

function BillingInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const billIdFocus = searchParams.get("billId");
  const txRefFocus = searchParams.get("txRef");

  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);
  const [forecast, setForecast] = useState<BillForecast | null>(null);
  const [usageComparison, setUsageComparison] = useState<UsageComparison | null>(null);
  const [outages, setOutages] = useState<ServiceOutage[]>([]);

  useEffect(() => {
    // Check user permissions
    const role = getUserRole();
    if (!role || !hasPermission(role, 'canViewBilling')) {
      router.replace('/dashboard');
      return;
    }
    setUserRole(role);
  }, [router]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [billsRes, txsRes] = await Promise.all([
        api.get<Bill[]>("billing/"),
        api.get<PaymentTransaction[]>("payments/transactions/"),
      ]);
      setBills(billsRes.data);
      setTransactions(txsRes.data);
    } catch (err) {
      console.error("Billing data fetch failed:", err);
      setError("Failed to load billing data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerInsights = async () => {
    try {
      const [forecastRes, usageRes, outageRes] = await Promise.allSettled([
        dashboardKpiApi.getBillForecast(),
        dashboardKpiApi.getUsageComparison(),
        dashboardKpiApi.getServiceOutages(),
      ]);
      if (forecastRes.status === "fulfilled") setForecast(forecastRes.value.data);
      if (usageRes.status === "fulfilled") setUsageComparison(usageRes.value.data);
      if (outageRes.status === "fulfilled") setOutages(outageRes.value.data.outages || []);
    } catch {
      // non-critical – silently ignore
    }
  };

  useEffect(() => {
    if (userRole) {
      fetchAll();
      fetchCustomerInsights();
    }
  }, [userRole]);

  useEffect(() => {
    if (loading || error) return;
    const timer = window.setTimeout(() => {
      let el: HTMLElement | null = null;
      if (txRefFocus) {
        const txn = transactions.find((t) => t.tx_ref === txRefFocus);
        if (txn) el = document.getElementById(`tx-row-${txn.id}`);
      }
      if (!el && billIdFocus) el = document.getElementById(`bill-row-${billIdFocus}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-blue-500", "ring-offset-2");
      window.setTimeout(() => {
        el?.classList.remove("ring-2", "ring-blue-500", "ring-offset-2");
      }, 2600);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [billIdFocus, txRefFocus, bills, transactions, loading, error]);

  const handlePay = async (billId: number) => {
    if (!userRole || !hasPermission(userRole, 'canManageBilling')) {
      setError("You don't have permission to make payments.");
      return;
    }
    
    try {
      setPayingBillId(billId);
      const res = await api.post(`payments/initiate/${billId}/`);
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        setError("Failed to initiate payment. Please try again.");
      }
    } catch (err) {
      console.error("Payment initiation failed:", err);
      setError("Failed to initiate payment. Please try again.");
    } finally {
      setPayingBillId(null);
    }
  };

  const totalBills = bills.length;
  const paidBills = bills.filter((b) => b.is_paid).length;
  const totalUnpaidAmount = bills
    .filter((b) => !b.is_paid)
    .reduce((sum, b) => sum + parseFloat(b.amount), 0);
  const totalUsage = bills.reduce((sum, b) => sum + b.usage_kwh, 0);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center transition-colors">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Could not load billing
          </h3>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={() => fetchAll()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const canManageBilling = userRole && hasPermission(userRole, 'canManageBilling');

  return (
    <PageTransition>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white transition-colors">
            Billing & Payments
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            Bill history and Chapa checkout activity — aligns with Django admin Bills & Transactions.
          </p>
        </div>

        {/* Service Outage Banner */}
        {outages.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">Active Service Alerts</h3>
                {outages.map((o) => (
                  <p key={o.id} className="text-sm text-red-600 dark:text-red-300 mt-1">
                    <span className="font-medium">{o.title}:</span> {o.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            title="Total Bills"
            value={totalBills.toString()}
            icon={<Receipt className="text-blue-500 dark:text-blue-400" />}
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          <SummaryCard
            title="Paid Bills"
            value={paidBills.toString()}
            icon={<CheckCircle className="text-green-500 dark:text-green-400" />}
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          <SummaryCard
            title="Unpaid Amount"
            value={`ETB ${totalUnpaidAmount.toLocaleString()}`}
            icon={<CreditCard className="text-amber-500 dark:text-amber-400" />}
            bgColor="bg-amber-50 dark:bg-amber-900/20"
          />
          <SummaryCard
            title="Total Water Usage"
            value={`${(totalUsage ?? 0).toFixed(1)} m³`}
            icon={<Droplet className="text-blue-500 dark:text-blue-400" />}
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
        </div>

        {/* Customer Insights: Forecast + Usage Comparison */}
        {(forecast || usageComparison) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {forecast && (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6 transition-colors">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Receipt className="text-blue-500" size={18} />
                  Next Bill Forecast
                </h2>
                <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  ETB {(forecast.forecast_amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                  Estimated {(forecast.forecast_usage ?? 0).toFixed(1)} m³ @ ETB {forecast.rate_per_unit}/m³
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    forecast.trend_pct > 0
                      ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : forecast.trend_pct < 0
                      ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                    {(forecast.trend_pct ?? 0) > 0 ? "+" : ""}{(forecast.trend_pct ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">vs avg ETB {(forecast.avg_amount ?? 0).toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>Confidence:</span>
                  <span className={`font-medium ${
                    forecast.confidence === "high" ? "text-emerald-500" : forecast.confidence === "medium" ? "text-amber-500" : "text-slate-400"
                  }`}>{forecast.confidence}</span>
                </div>
              </div>
            )}
            {usageComparison && (
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 p-6 transition-colors">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Droplet className="text-blue-500" size={18} />
                  Usage Comparison
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">This Month</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{(usageComparison.this_month.usage ?? 0).toFixed(1)} m³</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">ETB {(usageComparison.this_month.cost ?? 0).toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Last Month</p>
                    <p className="text-xl font-bold text-slate-500 dark:text-slate-400">{(usageComparison.last_month.usage ?? 0).toFixed(1)} m³</p>
                    <p className="text-sm text-slate-400">ETB {(usageComparison.last_month.cost ?? 0).toFixed(0)}</p>
                  </div>
                </div>
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                  usageComparison.change_pct > 0
                    ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    : usageComparison.change_pct < 0
                    ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                }`}>
                  {(usageComparison.change_pct ?? 0) > 0 ? "+" : ""}{(usageComparison.change_pct ?? 0).toFixed(1)}% vs last month
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-colors duration-500 mb-8">
          <div className="p-6 border-b dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your bills</h2>
          </div>

          {bills.length === 0 ? (
            <div className="p-12 text-center transition-colors">
              <Receipt className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No bills yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Bills created in admin will appear here for the logged-in customer.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 transition-colors">
                  <tr>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Bill ID</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Water Usage</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr
                      key={bill.id}
                      id={`bill-row-${bill.id}`}
                      className={`border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        billIdFocus === String(bill.id) && !txRefFocus
                          ? "bg-blue-50/70 dark:bg-blue-950/30"
                          : ""
                      }`}
                    >
                      <td className="p-4">
                        <span className="font-medium text-slate-900 dark:text-white">
                          #{bill.id}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {new Date(bill.billing_date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {(bill.usage_kwh ?? 0).toFixed(1)} m³
                      </td>
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        ETB {parseFloat(bill.amount).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {bill.is_paid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <CheckCircle size={12} />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <AlertCircle size={12} />
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {bill.is_paid ? (
                          <span className="text-slate-400 text-sm">—</span>
                        ) : (
                          canManageBilling ? (
                            <button
                              onClick={() => handlePay(bill.id)}
                              disabled={payingBillId === bill.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            >
                              {payingBillId === bill.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <CreditCard size={16} />
                                  Pay Now
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-sm">View only</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800 overflow-hidden transition-colors duration-500">
          <div className="p-6 border-b dark:border-slate-800">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Transaction History</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center transition-colors">
              <ArrowLeftRight className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                No transactions yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Your payment transactions will appear here after checkout.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800 transition-colors">
                  <tr>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">TX Ref</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Bill ID</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Amount</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                    <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      id={`tx-row-${txn.id}`}
                      className={`border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        txRefFocus === txn.tx_ref ? "bg-blue-50/70 dark:bg-blue-950/30" : ""
                      }`}
                    >
                      <td className="p-4">
                        <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                          {txn.tx_ref}
                        </code>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">#{txn.bill_id}</td>
                      <td className="p-4 font-medium text-slate-900 dark:text-white">
                        ETB {parseFloat(txn.amount).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {txn.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <CheckCircle size={12} />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            <AlertCircle size={12} />
                            {txn.status}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {new Date(txn.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  bgColor,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-xl p-6 border border-slate-200 dark:border-slate-700 transition-colors`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{title}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    </div>}>
      <BillingInner />
    </Suspense>
  );
}