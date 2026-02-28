export default function AIChatPage() {
  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold mb-4">AI Assistant</h2>

      <div className="border h-64 p-2 mb-3 overflow-y-scroll">
        <p><b>AI:</b> Hello! How can I help you?</p>
      </div>

      <input className="border p-2 w-full mb-2" placeholder="Type your question..." />
      <button className="bg-blue-600 text-white p-2 rounded">Send</button>
    </div>
  );
}