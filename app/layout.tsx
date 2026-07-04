import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const font = Space_Grotesk({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "twyn — find your twin in the room",
  description:
    "IRL matching for events. Timed rounds, a shared symbol, zero awkward wandering.",
};

export const viewport: Viewport = {
  themeColor: "#0b0713",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${font.className} bg-blobs`}>{children}</body>
    </html>
  );
}
