import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { StoreProvider } from "@/lib/store.tsx";

export const metadata: Metadata = {
  title: "Carbon Route Finder · India",
  description: "Which carbon-credit route (Verra, Gold Standard, India's CCTS) can an Indian project use? Rule-checked verdicts with confidence on every number.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg` },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body><StoreProvider>{children}</StoreProvider></body>
    </html>
  );
}
