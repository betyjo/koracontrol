export default function UsagePage() {
  return (
    <div className="p-6">
      <div className="card">
        <h1>Usage</h1>
        <p>
          Here you will see your daily and monthly electricity consumption.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card">
          <h3>Today</h3>
          <p>12 kWh</p>
        </div>

        <div className="card">
          <h3>This Month</h3>
          <p>230 kWh</p>
        </div>

        <div className="card">
          <h3>Last Month</h3>
          <p>210 kWh</p>
        </div>
      </div>
    </div>
  );
}