
// import "../styles/globals.css";
// import Navbar from "../components/Navbar";
// import Sidebar from "../components/Sidebar";
// import Footer from "../components/Footer";

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html>
//       <body>
//         <Navbar />
//         <div className="flex">
//           <Sidebar />
//           <main className="p-6 w-full">{children}</main>
//         </div>
//         <Footer/>
//       </body>
//     </html>
//   );
// }





import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import "../styles/globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-[160vh]">
        {/* Top */}
        <Navbar />

        {/* Middle (takes remaining space) */}
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-4">
            {children}
          </main>
        </div>

        {/* Bottom */}
        <Footer />
      </body>
    </html>
  );
}