import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

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
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen text-[#1d1d1f] bg-[#f5f5f7] selection:bg-[#8b5cf6]/20 selection:text-[#8b5cf6]">
        {children}
      </body>
    </html>
  );
}
