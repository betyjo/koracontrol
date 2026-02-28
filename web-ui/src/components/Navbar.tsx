import Link from "next/link";

export default function Navbar() {
  return (
    <header className="w-full bg-[#1c1a17] text-[#e7dcca] shadow-lg">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo / Title */}
        <h1 className="text-lg font-bold tracking-wide">
          Kora Control
        </h1>

        {/* Right: Login button */}
        <Link
          href="/auth/login"
          className="bg-[#1f1a16] px-4 py-2 rounded-lg
                     shadow-md transition-all duration-200
                     hover:bg-[#322821] hover:shadow-lg
                     active:scale-95"
        >
          Login
        </Link>
      </div>
    </header>
  );
}