import type { Metadata } from "next";
import { JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const bodyFont = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Harsh Upadhayay · Homelab Platform",
  description:
    "A self-hosted, production-grade homelab: zero-trust auth, GPU inference, full observability, and automated CI/CD — all on one machine.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark h-full antialiased ${bodyFont.variable} ${monoFont.variable}`}
    >
      <body className="min-h-full font-sans text-foreground">{children}</body>
    </html>
  );
}
