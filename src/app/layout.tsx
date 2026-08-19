import type { Metadata } from "next";

// Self-hosted brand fonts (bundled via npm, no build-time CDN fetch).
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecoVault",
  description:
    "Marketplace revenue recovery — scan, prove, recover. Mock-first development build.",
  icons: { icon: "/brand/favicon-master.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
