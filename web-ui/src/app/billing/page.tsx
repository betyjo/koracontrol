// export default function BillingPage() {
//   return (
//     <div>
//       <h2 className="text-2xl font-bold mb-4">Bill History</h2>

//       <table className="w-full border">
//         <tr className="bg-gray-100">
//           <th>Date</th>
//           <th>Amount</th>
//           <th>Status</th>
//         </tr>
//         <tr>
//           <td>Jan 2026</td>
//           <td>400 ETB</td>
//           <td>Paid</td>
//         </tr>
//       </table>

//       <button className="mt-4 bg-green-600 text-white p-2 rounded">
//         Pay Now (Chapa)
//       </button>
//     </div>
//   );
// }
export default function BillingPage() {
  return (
    <div className="p-6">
      <div className="card">
        <h1>Water Billing</h1>
        <p>View your water consumption and billing history.</p>

        <div className="mt-6 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Usage (m³)</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>January 2026</td>
                <td>18</td>
                <td>360 ETB</td>
                <td>
                  <span className="badge-success">Paid</span>
                </td>
              </tr>

              <tr>
                <td>February 2026</td>
                <td>21</td>
                <td>420 ETB</td>
                <td>
                  <span className="badge-warning">Pending</span>
                </td>
              </tr>

              <tr>
                <td>March 2026</td>
                <td>24</td>
                <td>480 ETB</td>
                <td>
                  <span className="badge-danger">Unpaid</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <button className="btn-primary">Pay with Chapa</button>
        </div>
      </div>
    </div>
  );
}