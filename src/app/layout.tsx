import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import ReownProvider from "@/context/ReownProvider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Taiko Token Claimer",
  description: "Claim your vested Taiko (TKO) tokens.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ReownProvider cookies={cookies}>
          {children}
          <Toaster />
        </ReownProvider>
      </body>
    </html>
  );
}
