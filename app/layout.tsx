import type React from "react"
// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SimulatorProvider } from "@/lib/context"

export const metadata: Metadata = {
  title: "LEGv8 Simulator",
  description: "Interactive LEGv8 single-cycle datapath simulator",
    generator: 'Hello moi nguoi, minh la Van Truong day :)'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SimulatorProvider>{children}</SimulatorProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
