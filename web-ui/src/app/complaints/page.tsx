export default function ComplaintsPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="card">
        <h1>Submit a Complaint</h1>
        <p>
          Use this form to report power issues, billing problems, or other
          service-related complaints.
        </p>

        <form className="mt-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">
              Full Name
            </label>
            <input type="text" placeholder="Enter your full name" />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">
              Meter Number
            </label>
            <input type="text" placeholder="Enter your meter number" />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">
              Complaint Type
            </label>
            <select>
              <option>Repair</option>
              <option>Billing Issue</option>
              <option>Meter Problem</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">
              Description
            </label>
            <textarea rows={4} placeholder="Describe your issue..." />
          </div>

          <button className="btn-primary">Submit Complaint</button>
        </form>
      </div>
    </div>
  );
}