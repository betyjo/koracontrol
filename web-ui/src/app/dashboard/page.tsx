export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 shadow rounded">
          <h3>Total Usage</h3>
          <p className="text-xl font-bold">120 kWh</p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <h3>Current Bill</h3>
          <p className="text-xl font-bold">450 ETB</p>
        </div>

        <div className="bg-white p-4 shadow rounded">
          <h3>Status</h3>
          <p className="text-green-600">Normal</p>
        </div>
      </div>
    </div>
  );
}

