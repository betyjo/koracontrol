export default function UsagePage() {
  return (
    <div className="p-6">
      <div className="card">
        <h1>Water Usage</h1>
        <p>
          Monitor your daily and monthly water consumption.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card">
          <h3>Today</h3>
          <p>120 liters</p>
        </div>

        <div className="card">
          <h3>This Week</h3>
          <p>850 liters</p>
        </div>

        <div className="card">
          <h3>This Month</h3>
          <p>3.2 m³</p>
        </div>
      </div>

      {/* Usage Details */}
      <div className="card mt-6">
        <h3>Recent Water Usage</h3>
        <p className="mb-4">
          Your recent daily water consumption records.
        </p>

        <div className="overflow-x-auto">
          <table>
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
      </div>
    </div>
  );
}