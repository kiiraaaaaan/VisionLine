import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, History, UploadCloud, ShieldAlert, Cpu, Package, Video } from "lucide-react";

export const metadata: Metadata = {
  title: "VisionLine Quality Inspection Platform",
  description: "Production-style Industrial Equipment Defect Detection Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex text-[#1d1d1f] bg-[#f5f5f7] font-sans selection:bg-[#0071e3]/20 selection:text-[#0071e3]">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#e5e5ea] bg-white/80 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 bg-[#0071e3] rounded-xl shadow-glow-indigo">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wider text-[#1d1d1f]">
                  VisionLine
                </h1>
                <p className="text-[9px] text-[#86868b] font-semibold tracking-widest uppercase">
                  Quality Assurance
                </p>
              </div>
            </div>

            <nav className="space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]/60 transition duration-200 group font-medium text-sm"
              >
                <LayoutDashboard className="w-5 h-5 text-[#86868b] group-hover:text-[#0071e3] transition" />
                Dashboard
              </Link>
              
              <Link
                href="/inspections"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]/60 transition duration-200 group font-medium text-sm"
              >
                <History className="w-5 h-5 text-[#86868b] group-hover:text-[#32ade6] transition" />
                History Gallery
              </Link>

              <Link
                href="/upload"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]/60 transition duration-200 group font-medium text-sm"
              >
                <UploadCloud className="w-5 h-5 text-[#86868b] group-hover:text-[#34c759] transition" />
                Inspection Sandbox
              </Link>

              <Link
                href="/live"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#e8e8ed]/60 transition duration-200 group font-medium text-sm"
              >
                <Video className="w-5 h-5 text-[#86868b] group-hover:text-[#ff3b30] transition" />
                Live Inspection
              </Link>
            </nav>
          </div>

          <div className="p-6 border-t border-[#e5e5ea] bg-white/20">
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34c759]"></span>
              </div>
              <div className="text-xs">
                <p className="font-semibold text-[#1d1d1f]">AI Service Active</p>
                <p className="text-[10px] text-[#86868b]">Keras MobileNetV2</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <header className="h-16 border-b border-[#e5e5ea] bg-white/60 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-40">
            <div className="text-sm font-medium text-[#86868b]">
              Real-time Industrial Equipment Defect Detection Platform
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs font-semibold text-[#0071e3]">
                <ShieldAlert className="w-4 h-4" />
                Platform Version 1.0.0
              </div>
            </div>
          </header>

          {/* Viewport */}
          <main className="flex-1 p-8 overflow-y-auto">
            {children}
          </main>
        </div>

      </body>
    </html>
  );
}
