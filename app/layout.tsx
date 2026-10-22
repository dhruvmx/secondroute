import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SecondRoute | Recovery operations",
  description:
    "Giving discarded materials another destination. Event material recovery with recipient confirmation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
