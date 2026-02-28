export default function LoginPage() {
  return (
    <div className="max-w-sm mx-auto mt-20 p-6 shadow rounded">
      <h2 className="text-xl font-bold mb-4">Login</h2>
      <input className="border p-2 w-full mb-3" placeholder="Email" />
      <input className="border p-2 w-full mb-3" placeholder="Password" type="password" />
      <button className="bg-blue-600 text-white w-full p-2 rounded">Login</button>
    </div>
  );
}