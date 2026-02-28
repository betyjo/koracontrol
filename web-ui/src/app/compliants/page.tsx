export default function ComplaintPage() {
  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-4">Submit Complaint</h2>

      <input className="border p-2 w-full mb-3" placeholder="Title" />
      <textarea className="border p-2 w-full mb-3" placeholder="Describe your issue"></textarea>
      <button className="bg-blue-600 text-white p-2 rounded">Submit</button>
    </div>
  );
}