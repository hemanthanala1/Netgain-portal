import Link from 'next/link'
import { Shield, ArrowLeft, Lock, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Privacy Policy — Netgain Portal',
  description: 'Privacy Policy and Data Protection disclosure for Netgain Portal and Google OAuth integration.'
}

export default function PrivacyPolicyPage() {
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
            <Shield className="h-3.5 w-3.5" /> Official Data Protection Policy
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Effective Date: January 1, 2026 &bull; Last Updated: August 1, 2026
          </p>
        </div>

        {/* Overview */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> 1. Overview & Purpose of Netgain Portal
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Netgain Portal (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is operated by Netgain Studio (accessible at <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">https://erp.netgainstudio.com/</code>). Netgain Portal is an enterprise client collaboration platform designed to streamline project management, document storage, statements of work, deliverables tracking, and partner communication.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This Privacy Policy outlines how we collect, use, store, and safeguard information when you use Netgain Portal or authenticate using third-party identity providers such as Google Sign-In.
          </p>
        </section>

        {/* Google OAuth & User Data */}
        <section className="space-y-4 rounded-2xl bg-card border border-border/80 p-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-500" /> 2. Google OAuth & API User Data Policy Compliance
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When you sign in to Netgain Portal using your Google Account, we request access only to necessary basic profile information (such as your name, email address, and profile picture) to authenticate your account and provision appropriate access roles within your client dashboard.
          </p>

          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-foreground">How We Use Google Data:</h3>
            <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-5">
              <li><strong className="text-foreground">Authentication & Account Creation:</strong> To verify your identity and grant secure login access to Netgain Portal.</li>
              <li><strong className="text-foreground">Google Drive Integration (Optional):</strong> If enabled, allows authorized project managers and clients to sync and view project folder assets stored in Google Drive.</li>
              <li><strong className="text-foreground">Google Calendar Sync (Optional):</strong> If enabled, syncs client meeting requests and project milestone deadlines with your Google Calendar.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1.5">
            <p className="font-semibold text-primary flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Limited Use Disclosure
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Netgain Portal&apos;s use and transfer to any other app of information received from Google APIs will adhere to <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">Google API Services User Data Policy</a>, including the Limited Use requirements. We do NOT sell, rent, or share your Google user data with third-party advertisers or AI model training services.
            </p>
          </div>
        </section>

        {/* Data Collection */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> 3. Information We Collect
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li><strong className="text-foreground">Account Information:</strong> Name, professional email address, company name, and encrypted passwords.</li>
            <li><strong className="text-foreground">Workspace & Document Data:</strong> Agreements, statements of work, invoices, uploaded files, and project notes explicitly stored within Netgain Portal.</li>
            <li><strong className="text-foreground">Technical Logs:</strong> IP address, browser type, device information, and security audit timestamps to prevent unauthorized access.</li>
          </ul>
        </section>

        {/* Data Security & Retention */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">4. Data Security & Storage</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All data stored within Netgain Portal is protected using industry-standard 256-bit SSL/TLS encryption in transit and AES-256 encryption at rest. Access control is strictly managed via role-based authentication (RBAC).
          </p>
        </section>

        {/* Data Deletion */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">5. Data Retention & Deletion Requests</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You may request deletion of your account and personal data at any time by contacting our privacy officer at <a href="mailto:privacy@netgainstudio.com" className="text-primary underline font-medium">privacy@netgainstudio.com</a>. Upon verification of your identity, we will permanently purge your personal account records within 30 days, except where retention is legally required.
          </p>
        </section>

        {/* Contact Us */}
        <section className="space-y-3 pt-4 border-t border-border/40">
          <h2 className="text-xl font-bold text-foreground">6. Contact Information</h2>
          <p className="text-sm text-muted-foreground">
            For any questions regarding this Privacy Policy or data processing practices on Netgain Portal, please contact us:
          </p>
          <div className="p-4 rounded-xl bg-card border border-border text-xs space-y-1">
            <p className="font-bold text-foreground">Netgain Studio — Privacy & Compliance</p>
            <p className="text-muted-foreground">Website: <a href="https://erp.netgainstudio.com" className="text-primary hover:underline">https://erp.netgainstudio.com/</a></p>
            <p className="text-muted-foreground">Email: <a href="mailto:support@netgainstudio.com" className="text-primary hover:underline">support@netgainstudio.com</a></p>
          </div>
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
