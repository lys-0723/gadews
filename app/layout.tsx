import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { KnowledgeAssistant } from "@/components/gadews/assistant/knowledge-assistant";
import { LocaleProvider } from "@/components/gadews/locale-provider";
import { readLocalePreference } from "@/lib/gadews/i18n/locale";

import "./globals.css";
import "@/components/gadews/assistant/assistant.css";
import "@/components/gadews/home/ocean-home.css";
import "@/components/gadews/home/hero-intro.css";
import "@/components/gadews/home/report-globe.css";
import "@/components/gadews/home/life-particles.css";

const _inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
});

const _jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-variable.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "GADEWS | Global Aquaculture Disease Early Warning System",
  description:
    "连接环境、水生动物与人的健康。公开疫病报告、环境快照和可解释规则支持水生动物疾病风险筛查。Aquatic health through connected evidence.",
};

export const viewport: Viewport = {
  themeColor: "#061524",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preference = await cookies();
  const locale = readLocalePreference(preference.toString());
  return (
    <html lang={locale} className={`${_inter.variable} ${_jetbrainsMono.variable}`}>
      <body className="font-sans antialiased"><LocaleProvider initialLocale={locale}>{children}<KnowledgeAssistant /></LocaleProvider></body>
    </html>
  );
}
