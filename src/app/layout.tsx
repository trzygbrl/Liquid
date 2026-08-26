import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "KayApp: Philippine Clinical Triage & Specialist Booking",
  description: "AI-powered clinical triage matching patients to verified specialists and clinics across the Philippines.",
};

// `viewportFit: 'cover'` lets the page paint behind the notch/home-indicator
// safe areas instead of Safari/Chrome letterboxing around them -- required
// for `env(safe-area-inset-bottom)` (used by BottomNavBar) to resolve to a
// real value instead of 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex min-h-dvh flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
