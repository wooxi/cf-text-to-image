import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "文生图工作室",
  description: "私人 AI 文生图工作台",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e0f",
};

/**
 * 在首帧之前把主题写进 <html>，避免浅色用户每次刷新都闪一下深色。
 * 用阻塞式外链脚本而不是内联脚本：静态常量内联会命中 dangerouslySetInnerHTML 告警，
 * 而且外链写法在静态导出下更直观。
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          必须同步执行：defer/async 会让浅色用户先看到一帧深色（FOUC）。
          脚本内容是一个纯静态常量，不涉及任何用户输入。
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-boot.js" />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>{children}</AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
