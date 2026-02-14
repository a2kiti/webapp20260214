import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ゲーム時間チェック",
  description: "生活習慣チェックで今日のゲーム時間を決めるアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
