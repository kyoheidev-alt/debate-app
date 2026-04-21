import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSerif = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "匿名ディベートチャット",
  description: "匿名で参加できるディベートチャットルーム",
};

export const viewport: Viewport = {
  themeColor: "#0D1B2A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${notoSans.variable} ${notoSerif.variable}`}
    >
      <body className="min-h-screen bg-navy-900 font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
