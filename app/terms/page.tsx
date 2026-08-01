import Link from 'next/link'
import { FileText, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Terms of Service — Netgain Portal',
  description: 'Terms of Service and Conditions of Use for Netgain Portal.'
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center p-1.5">
              <img src="/logo.png" alt="Netgain Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                NETGAIN PORTAL
              </span>
            </div>
          </Link>

          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="space-y-3 border-b border-border/40 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
            <FileText className="h-3.5 w-3.5" /> Official Platform Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: January 1, 2026 &bull; Last Updated: August 1, 2026
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">1. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using Netgain Portal (accessible at <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">https://erp.netgainstudio.com/</code>), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not access or use the application.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">2. Description of Netgain Portal Services</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Netgain Portal is a secure business operating workspace provided by Netgain Studio. The portal allows clients and authorized personnel to:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
            <li>Review and sign digital Statements of Work (SOWs) and commercial proposals.</li>
            <li>Track project milestones, deliverables, and service progress.</li>
            <li>Access confidential document vaults and billing statements.</li>
            <li>Authenticate via Google OAuth Single Sign-On (SSO) and integrate project files with Google Drive.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">3. User Accounts & Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Account access to Netgain Portal is granted to authorized client representatives and internal team members. Users are responsible for maintaining the confidentiality of their login credentials and for all activities that occur under their account.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">4. Acceptable Use Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You agree not to misuse Netgain Portal, attempt unauthorized access to system resources, upload malicious content, or violate any applicable laws or intellectual property rights.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">5. Termination & Access Modification</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Netgain Studio reserves the right to suspend or terminate portal access for users who violate these terms or upon conclusion of commercial agreements.
          </p>
        </section>

        <section className="space-y-3 pt-4 border-t border-border/40">
          <h2 className="text-xl font-bold text-foreground">6. Contact & Support</h2>
          <p className="text-sm text-muted-foreground">
            For questions regarding these Terms of Service, please reach out to us at <a href="mailto:support@netgainstudio.com" className="text-primary underline font-medium">support@netgainstudio.com</a>.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/40 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Netgain Studio. All rights reserved. Netgain Portal.
        </div>
      </footer>
    </div>
  )
}
