import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "無期租寓｜可玩 Demo",
  description: "清除 B1、B2 底層異常源；付得起租金，活得像人。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
