import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import React from "react";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({ subsets: ["latin"] });
export const metadata: Metadata = {
  title: "welth",
  description: "one stop finance platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.className} pt-32`}>
          <Header />
          <main className="min-h-screen">{children}</main>

          <footer className="bg-blue-50 py-12">
            <div className="container mx-auto text-center">
              <p>Made with Love </p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
