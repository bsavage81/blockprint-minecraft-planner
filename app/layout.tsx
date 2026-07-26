import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blockprint — Minecraft Build Planner",
  description: "Create layered Minecraft blueprints with a spreadsheet-style block editor and automatic material counts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
