import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RecoVault",
  description:
    "Marketplace-agnostic revenue recovery. Mock-first development build.",
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
