import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PaperBuddy — RAG Research Assistant',
  description: 'Ask questions across your research papers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}