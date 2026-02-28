// import Link from "next/link";

// export default function Sidebar() {
//   return (
//     <aside className="w-60 bg-gray-100 h-screen p-4">
//       <ul className="space-y-3">
//         <li><Link href="/dashboard">Dashboard</Link></li>
//         <li><Link href="/usage">Usage</Link></li>
//         <li><Link href="/billing">Billing</Link></li>
//         <li><Link href="/complaints">Complaints</Link></li>
//         <li><Link href="/ai-chat">AI Assistant</Link></li>
//         <li><Link href="/settings">Settings</Link></li>
//       </ul>
//     </aside>
//   );
// }




import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 min-h-screen bg-[#1c1a17] text-[#e7dcca] shadow-xl">
      {/* <div className="p-5 text-xl font-bold border-b border-[#3a2f26]">
        Kora Control
      </div> */}

      <nav className="p-4 space-y-2">
        <Link href="/dashboard" className="sidebar-btn">
          Dashboard
        </Link>

        <Link href="/usage" className="sidebar-btn">
          Usage
        </Link>

        <Link href="/billing" className="sidebar-btn">
          Billing
        </Link>

        <Link href="/complaints" className="sidebar-btn">
          Complaints
        </Link>

        <Link href="/ai-chat" className="sidebar-btn">
          AI Assistant
        </Link>

      </nav>
    </aside>
  );
}
