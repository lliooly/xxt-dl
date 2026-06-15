import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "学习通作业整理",
  description: "学习通作业整理桌面端",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
