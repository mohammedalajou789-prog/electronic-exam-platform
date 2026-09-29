import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import './globals.css'

// Plus Jakarta Sans, self-hosted: the font file lives in this repo (src/app/fonts),
// so the build never downloads it from Google (that download sometimes failed
// and broke the build). Variable font: one file covers every weight (200-800).
// Latin subset, same as before. License: src/app/fonts/OFL.txt
const plusJakarta = localFont({
  src: './fonts/PlusJakartaSans-latin-wght-normal.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Medical Club — Exam Platform',
  description: 'The easiest way to practice previous medical examinations',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.className} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

