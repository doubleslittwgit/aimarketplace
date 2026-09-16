import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.getbuildbay.com"),
  title: {
    default: "BuildBay — AIでつくったツールが集まる港",
    template: "%s | BuildBay",
  },
  description:
    "AIを活用して開発したツールを、無料でも有料でも公開・販売できるマーケットプレイス。個人開発者の作ったツールを、必要としている人へ。",
  keywords: ["AIツール", "マーケットプレイス", "個人開発", "Claude Code", "自動化ツール"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/",
    siteName: "BuildBay",
    title: "BuildBay — AIでつくったツールが集まる港",
    description:
      "AIを活用して開発したツールを、無料でも有料でも公開・販売できるマーケットプレイス。",
  },
  twitter: {
    card: "summary_large_image",
    title: "BuildBay — AIでつくったツールが集まる港",
    description:
      "AIを活用して開発したツールを、無料でも有料でも公開・販売できるマーケットプレイス。",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg bg-noise">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
