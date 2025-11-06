// app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ace-six-gules.vercel.app'),
  title: {
    default: 'ACE — Autocontent Engine',
    template: '%s · ACE',
  },
  description: 'Genera copy e caroselli da brief. API veloci, costi prevedibili, qualità costante.',
  openGraph: {
    title: 'ACE — Autocontent Engine',
    description:
      'Genera copy e caroselli da brief. API veloci, costi prevedibili, qualità costante.',
    url: '/',
    siteName: 'ACE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ACE — Autocontent Engine',
    description:
      'Genera copy e caroselli da brief. API veloci, costi prevedibili, qualità costante.',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="antialiased">{children}</body>
    </html>
  )
}
