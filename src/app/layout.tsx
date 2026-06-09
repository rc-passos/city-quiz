import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CitySnap — Guess the City',
  description: 'Can you identify cities from AI-generated images?',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
