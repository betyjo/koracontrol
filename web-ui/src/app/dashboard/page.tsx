export default function DashboardPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="card">
        <h1>Dashboard</h1>
        <p>
          Overview of your water usage, billing, and service status.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <div className="card">
          <h3>Today’s Usage</h3>
          <p>120 liters</p>
        </div>

        <div className="card">
          <h3>This Month</h3>
          <p>3.2 m³</p>
        </div>

        <div className="card">
          <h3>Current Bill</h3>
          <p>480 ETB</p>
        </div>

        <div className="card">
          <h3>Complaints</h3>
          <p>1 Pending</p>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <h3>Recent Water Usage</h3>
          <table className="mt-3">
            <thead>
              <tr>
                <th>Date</th>
                <th>Usage (liters)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2026-02-25</td>
                <td>115</td>
                <td>
                  <span className="badge-success">Normal</span>
                </td>
              </tr>
              <tr>
                <td>2026-02-26</td>
                <td>140</td>
                <td>
                  <span className="badge-warning">High</span>
                </td>
              </tr>
              <tr>
                <td>2026-02-27</td>
                <td>100</td>
                <td>
                  <span className="badge-success">Normal</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>System Notices</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>✔ Water supply is normal.</li>
            <li>⚠ Please pay your February bill.</li>
            <li>✔ No maintenance scheduled today.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}