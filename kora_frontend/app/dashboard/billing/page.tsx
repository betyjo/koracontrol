"use client";

import { useEffect, useState } from 'react';
import { Receipt, CreditCard, CheckCircle, AlertCircle, Loader2, Calendar, Zap } from 'lucide-react';
import api from '@/lib/api';

interface Bill {
  id: number;
  amount: string;
  usage_kwh: number;
  is_paid: boolean;
  billing_date: string;
}

export default function BillingPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingBillId, setPayingBillId] = useState<number | null>(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('billing/');
      setBills(res.data);
    } catch (err) {
      console.error('Failed to fetch bills:', err);
      setError('Failed to load bills. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (billId: number) => {
    try {
      setPayingBillId(billId);
      const res = await api.post(`payments/initiate/${billId}/`);
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url; // Redirect to Chapa
      } else {
        setError('Failed to initiate payment. Please try again.');
      }
    } catch (err) {
      console.error('Payment initiation failed:', err);
      setError('Failed to initiate payment. Please try again.');
    } finally {
      setPayingBillId(null);
    }
  };

  // Calculate summary stats
  const totalBills = bills.length;
  const paidBills = bills.filter(b => b.is_paid).length;
  const unpaidBills = totalBills - paidBills;
  const totalUnpaidAmount = bills
    .filter(b => !b.is_paid)
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Bills</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={fetchBills}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Billing & Payments</h1>
        <p className="text-slate-500 mt-1">View your bill history and make payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard 
          title="Total Bills"
          value={totalBills.toString()}
          icon={<Receipt className="text-blue-500" />}
          bgColor="bg-blue-50"
        />
        <SummaryCard 
          title="Paid Bills"
          value={paidBills.toString()}
          icon={<CheckCircle className="text-green-500" />}
          bgColor="bg-green-50"
        />
        <SummaryCard 
          title="Unpaid Amount"
          value={`ETB ${totalUnpaidAmount.toLocaleString()}`}
          icon={<CreditCard className="text-amber-500" />}
          bgColor="bg-amber-50"
        />
        <SummaryCard 
          title="Total Usage"
          value={`${totalUsage.toFixed(1)} kWh`}
          icon={<Zap className="text-purple-500" />}
          bgColor="bg-purple-50"
        />
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-900">Your Bill History</h2>
        </div>
        
        {bills.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto h-16 w-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Bills Found</h3>
            <p className="text-slate-500">You don&apos;t have any bills yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold text-slate-700">Bill ID</th>
                  <th className="p-4 font-semibold text-slate-700">Date</th>
                  <th className="p-4 font-semibold text-slate-700">Usage</th>
                  <th className="p-4 font-semibold text-slate-700">Amount</th>
                  <th className="p-4 font-semibold text-slate-700">Status</th>
                  <th className="p-4 font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className="font-medium text-slate-900">#{bill.id}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-slate-700">
                          {new Date(bill.billing_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-slate-400" />
                        <span className="text-slate-700">{bill.usage_kwh} kWh</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-900">
                        ETB {parseFloat(bill.amount).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        bill.is_paid 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {bill.is_paid ? (
                          <>
                            <CheckCircle size={12} />
                            Paid
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} />
                            Unpaid
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-4">
                      {!bill.is_paid ? (
                        <button 
                          onClick={() => handlePay(bill.id)}
                          disabled={payingBillId === bill.id}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          {payingBillId === bill.id ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
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
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <CreditCard className="text-blue-600" size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Secure Payments with Chapa</h3>
            <p className="text-blue-700 text-sm">
              All payments are processed securely through Chapa. You&apos;ll be redirected to Chapa&apos;s 
              secure checkout page to complete your payment. We accept various payment methods 
              including bank transfers, cards, and mobile money.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor: string;
}

function SummaryCard({ title, value, icon, bgColor }: SummaryCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow">
      <div className={`p-3 ${bgColor} rounded-lg w-fit mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
