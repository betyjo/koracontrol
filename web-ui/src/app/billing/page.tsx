export default function BillingPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Bill History</h2>

      <table className="w-full border">
        <tr className="bg-gray-100">
          <th>Date</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>Jan 2026</td>
          <td>400 ETB</td>
          <td>Paid</td>
        </tr>
      </table>

      <button className="mt-4 bg-green-600 text-white p-2 rounded">
        Pay Now (Chapa)
      </button>
    </div>
  );
}