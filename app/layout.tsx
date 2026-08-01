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
  title: 'Netgain Portal — Official Client & Business Operating Platform',
  description: 'Netgain Portal is an enterprise workspace for client collaboration, project milestone tracking, document vault, statements of work, and Google SSO authentication.',
  icons: { icon: '/favicon.ico' },
  verification: {
    google: 'D7qWDNT68YGOdIE0m9ENaThUbJunjeMfJobGGDhxC58',
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
