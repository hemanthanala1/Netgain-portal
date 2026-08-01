import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://erp.netgainstudio.com'),
  applicationName: 'Netgain Portal',
  title: {
    default: 'Netgain Portal',
    template: '%s — Netgain Portal',
  },
  description: 'Netgain Portal is an all-in-one business operating platform for managing clients, quotations, invoices, projects, CRM, marketing, automation, and business operations.',
  keywords: ['Netgain Portal', 'business operating platform', 'client portal', 'CRM', 'invoices', 'project management', 'Netgain Studio'],
  authors: [{ name: 'Netgain Studio', url: 'https://netgainstudio.com' }],
  creator: 'Netgain Studio',
  publisher: 'Netgain Studio',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
  verification: {
    google: 'D7qWDNT68YGOdIE0m9ENaThUbJunjeMfJobGGDhxC58',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://erp.netgainstudio.com',
    siteName: 'Netgain Portal',
    title: 'Netgain Portal',
    description: 'Netgain Portal is an all-in-one business operating platform for managing clients, quotations, invoices, projects, CRM, marketing, automation, and business operations.',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
        alt: 'Netgain Portal',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Netgain Portal',
    description: 'Netgain Portal is an all-in-one business operating platform for managing clients, quotations, invoices, projects, CRM, and operations.',
    images: ['/logo.png'],
    creator: '@netgainstudio',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
