import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Praow Form Collector v2",
  description: "Praow water customer intake form"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
