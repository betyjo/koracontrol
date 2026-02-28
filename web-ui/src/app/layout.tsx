
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Navbar />
        <div className="flex">
          <Sidebar />
          <main className="p-6 w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}