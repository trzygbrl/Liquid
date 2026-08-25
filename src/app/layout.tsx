import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AmbientBackground from "@/components/AmbientBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicAccess — Philippine Clinical Triage & Specialist Booking",
  description: "AI-powered clinical triage matching patients to verified specialists and clinics across the Philippines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative bg-[#F8F7FA] text-[#1E1B2E]">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
