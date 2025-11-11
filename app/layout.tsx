import type React from "react"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "@/components/ui/toaster"
import { Header } from "@/components/header"
import { SponsorButton } from "@/components/sponsor-button"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "ScheduleTime - Find the Perfect Meeting Time",
  description: "Coordinate schedules effortlessly with our intuitive meeting scheduler",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-adsense-account" content="ca-pub-6485506879625570" />
        {/* Google AdSense site-wide script (loads on every page, in head) */}
        <Script
          id="adsense-global"
          async
          strategy="beforeInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6485506879625570"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Toaster />
            <SponsorButton />
          </div>
        </Providers>
      </body>
    </html>
  )
}
