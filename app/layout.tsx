import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "XXT DL 本地题库",
  description: "学习通作业整理与本地刷题 Web 应用",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
