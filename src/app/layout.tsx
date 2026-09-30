import type { Metadata } from 'next'
import { preload } from 'react-dom'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import './globals.css'

// Plus Jakarta Sans is self-hosted: public/fonts/PlusJakartaSans-latin-wght-normal.woff2
// (variable font, weights 200-800, latin subset; license: public/fonts/OFL.txt).
// It is registered in globals.css under its real name "Plus Jakarta Sans", which is
// the name the pages use in their own styles. The build never downloads fonts
// from Google any more (that download sometimes failed and broke the build).
const FONT_FILE = '/fonts/PlusJakartaSans-latin-wght-normal.woff2'

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
  // Start downloading the font right away, before the CSS asks for it
  preload(FONT_FILE, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

