import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLanguage, getMessages } from "@/lib/server";
import { switchLanguageAction } from "./actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Assignment author, shown on every page.
const AUTHOR = "강우현";

export const metadata: Metadata = {
  title: "투표 / Voting",
  description: "Anonymous link-based polls",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const t = await getMessages();
  return (
    <html
      lang={await getLanguage()}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <form action={switchLanguageAction} className="flex justify-end px-4 pt-4">
          <button type="submit" className="text-sm text-zinc-500 underline">{t.switchLanguage}</button>
        </form>
        {children}
        <footer className="mt-auto px-4 py-6 text-center text-sm text-zinc-500">
          {t.madeBy}: {AUTHOR}
        </footer>
      </body>
    </html>
  );
}
