export default function Footer() {
  return (
    <footer className="w-full bg-[#1c1a17] text-[#e7dcca] border-t border-[#3a2f26] rounded-t-3xl">
      {/* 👆 rounded-t-3xl makes the top edges smooth */}

      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Left */}
          <div className="text-sm">
            <p className="font-semibold tracking-wide">
              Kora Control – Water Management System
            </p>
            <p className="text-[#cfc3b3] mt-2">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>

          {/* Center */}
          <div className="flex gap-8 text-sm">
            <span className="hover:text-white transition cursor-pointer">
              Privacy Policy
            </span>
            <span className="hover:text-white transition cursor-pointer">
              Terms of Service
            </span>
            <span className="hover:text-white transition cursor-pointer">
              Help & Support
            </span>
          </div>

          {/* Right */}
          <div className="text-sm text-[#cfc3b3]">
            Designed for Smart Water Monitoring
          </div>
        </div>
      </div>
    </footer>
  );
}