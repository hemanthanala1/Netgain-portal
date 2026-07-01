import type { CampaignStrategyForm, BlueprintForm, MarketingIntelligenceForm, ApprovalStatus } from './ai-types'

// ── Prompt Generators ───────────────────────────────────────────────────

export function generateCampaignPrompt(f: CampaignStrategyForm): string {
  return `You are a Senior Digital Marketing Strategist with 15+ years of experience in building comprehensive marketing strategies for businesses.

## BUSINESS PROFILE

**Business Name:** ${f.businessName}
**Category:** ${f.businessCategory}
**Website:** ${f.website || 'Not provided'}
**Phone:** ${f.phone || 'Not provided'}
**Email:** ${f.email || 'Not provided'}
**Location:** ${f.location || 'Not provided'}

## BUSINESS OVERVIEW

${f.businessDescription || 'No description provided.'}

## PRODUCTS & SERVICES

**Products:** ${f.products || 'Not specified'}
**Services:** ${f.services || 'Not specified'}
**Current Offers:** ${f.offers || 'None specified'}

## COMPETITIVE LANDSCAPE

${f.competitors || 'Competitor analysis not provided.'}

## CURRENT MARKETING

${f.currentMarketing || 'No current marketing details provided.'}

## BUDGET

**Monthly Budget:** ₹${f.monthlyBudget || '0'}
**Platform-Specific Budget:** ${f.platformBudget || 'Not allocated'}

## TARGET AUDIENCE

${f.targetAudience || 'Not defined'}

## BUSINESS GOALS

${f.businessGoals || 'Not specified'}

## TIMELINE

${f.timeline || 'Not specified'}

## ADDITIONAL NOTES

${f.notes || 'None'}

---

## YOUR TASK

Based on the above business profile, create a COMPREHENSIVE MARKETING STRATEGY that includes:

1. **Executive Summary** — Business overview and strategic direction
2. **Market Analysis** — Industry trends, competitor analysis, SWOT
3. **Target Audience Personas** — Detailed buyer personas with demographics, psychographics, pain points
4. **Brand Positioning** — Unique value proposition, messaging framework
5. **Channel Strategy** — Platform-by-platform strategy (Meta, Google, SEO, Content, Email, WhatsApp)
6. **Content Strategy** — Content calendar, themes, formats, frequency
7. **Paid Advertising Plan** — Budget allocation, campaign structure, targeting strategy
8. **SEO Strategy** — Keyword targets, on-page/off-page plan, technical SEO
9. **Social Media Plan** — Platform-specific content and engagement strategy
10. **Email Marketing** — Automation flows, newsletters, lead nurturing
11. **KPIs & Metrics** — Measurable goals, tracking plan, reporting cadence
12. **90-Day Action Plan** — Week-by-week execution roadmap
13. **Budget Breakdown** — Detailed allocation across channels
14. **Risk Mitigation** — Potential challenges and contingency plans

Format the strategy as a professional document suitable for client presentation.
Use data-driven recommendations where possible.
Include specific, actionable items — not generic advice.`
}


export function generateBlueprintPrompt(f: BlueprintForm): string {
  return `You are a Senior Software Architect and Product Manager with 15+ years of experience building enterprise-grade applications.

## PRODUCT OVERVIEW

**Product Name:** ${f.productName}
**Project Type:** ${f.projectType}
**Platform:** ${f.platform || 'Web'}
**Timeline:** ${f.timeline || 'Not specified'}
**Budget:** ${f.budget ? '₹' + f.budget : 'Not specified'}

## TARGET USERS

${f.targetUsers || 'Not defined'}

## OBJECTIVES

${f.objectives || 'Not specified'}

## FEATURES & MODULES

**Core Features:**
${f.features || 'Not specified'}

**Modules:**
${f.modules || 'Not specified'}

## USER ROLES & PERMISSIONS

${f.userRoles || 'Not defined'}

## TECHNICAL REQUIREMENTS

**Tech Stack:** ${f.techStack || 'Not specified'}
**Database:** ${f.database || 'Not specified'}
**APIs:** ${f.apis || 'Not specified'}

## INTEGRATIONS

${f.integrations || 'None specified'}

## SECURITY & AUTH

**Authentication:** ${f.authentication || 'Not specified'}
**Security Requirements:** ${f.security || 'Standard security practices'}

## PAYMENTS

${f.payments || 'Not applicable'}

## NOTIFICATIONS

${f.notifications || 'Not specified'}

## AI FEATURES

${f.aiFeatures || 'None planned'}

## PERFORMANCE

${f.performance || 'Standard performance requirements'}

---

## YOUR TASK

Based on the above requirements, generate a COMPREHENSIVE PRD (Product Requirements Document) that includes:

1. **Executive Summary** — Product vision, goals, and success criteria
2. **Problem Statement** — What problem this product solves
3. **User Personas** — Detailed personas with goals and pain points
4. **Functional Requirements** — Feature-by-feature specification with acceptance criteria
5. **Non-Functional Requirements** — Performance, security, scalability, accessibility
6. **System Architecture** — High-level architecture diagram description, component interaction
7. **Database Schema** — Tables, relationships, key fields
8. **API Specification** — Endpoints, methods, request/response formats
9. **UI/UX Requirements** — Key screens, user flows, wireframe descriptions
10. **Authentication & Authorization** — Auth flow, role-based access matrix
11. **Third-Party Integrations** — APIs, services, webhooks
12. **Development Phases** — Sprint-by-sprint breakdown
13. **Testing Strategy** — Unit, integration, E2E, UAT approach
14. **Deployment Plan** — CI/CD, environments, rollback strategy
15. **Risk Assessment** — Technical risks and mitigation
16. **Success Metrics** — KPIs and measurement approach

Format as a professional PRD document ready for development team handoff.
Include specific, technical details — not generic statements.`
}


export function generateMarketingReportPrompt(f: MarketingIntelligenceForm): string {
  const sections: string[] = []

  sections.push(`You are a Senior Marketing Analyst with expertise in digital marketing analytics, ROI optimization, and data-driven strategy.

## REPORT CONTEXT

**Client:** ${f.client}
**Period:** ${f.period}
**Channels Analyzed:** ${f.channels.join(', ') || 'Not specified'}`)

  if (f.metaSpend || f.metaRevenue) {
    sections.push(`
## META ADS DATA

- Ad Spend: ₹${f.metaSpend || '0'}
- Revenue: ₹${f.metaRevenue || '0'}
- Leads/Conversions: ${f.metaLeads || 'N/A'}
- Impressions: ${f.metaImpressions || 'N/A'}
- ROAS: ${f.metaROAS || 'Calculate from above'}`)
  }

  if (f.googleSpend || f.googleRevenue) {
    sections.push(`
## GOOGLE ADS DATA

- Ad Spend: ₹${f.googleSpend || '0'}
- Revenue: ₹${f.googleRevenue || '0'}
- Clicks: ${f.googleClicks || 'N/A'}
- Conversions: ${f.googleConversions || 'N/A'}`)
  }

  if (f.seoTraffic || f.seoRanking) {
    sections.push(`
## SEO DATA

- Organic Traffic: ${f.seoTraffic || 'N/A'} visitors
- Avg Keyword Ranking: #${f.seoRanking || 'N/A'}
- Keywords in Top 10: ${f.seoKeywords || 'N/A'}`)
  }

  if (f.uploadedFiles.length > 0) {
    sections.push(`
## UPLOADED DATA FILES

${f.uploadedFiles.map(file => `- ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`).join('\n')}

Note: The above files contain raw data. Analyze the data provided in this prompt and the uploaded files to generate insights.`)
  }

  if (f.summary) sections.push(`\n## EXECUTIVE SUMMARY\n\n${f.summary}`)
  if (f.insights) sections.push(`\n## KEY INSIGHTS PROVIDED\n\n${f.insights}`)

  sections.push(`
---

## YOUR TASK

Based on the above marketing data, generate a COMPREHENSIVE MARKETING INTELLIGENCE REPORT that includes:

1. **Executive Summary** — High-level performance overview
2. **Channel Performance Breakdown** — Detailed metrics per channel
3. **ROI Analysis** — ROAS, CPA, CPL across channels
4. **Audience Insights** — Demographics, behavior, engagement patterns
5. **Campaign Performance** — Top and bottom performing campaigns
6. **Competitive Benchmarking** — Industry comparison where applicable
7. **Trend Analysis** — Month-over-month trends and projections
8. **Budget Optimization** — Recommendations for budget reallocation
9. **Actionable Recommendations** — Specific, prioritized action items
10. **Next Month Strategy** — Detailed execution plan
11. **KPI Forecast** — Projected metrics for next period

Format as a professional report with tables, clear sections, and data-driven insights.
Include specific numbers and percentages — not generic observations.`)

  return sections.join('\n')
}


// ── Clipboard & File Helpers ────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}

export function downloadAsTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}


// ── Status Colors ───────────────────────────────────────────────────────

export function getApprovalStatusColor(status: ApprovalStatus | string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    pending_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    needs_revision: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  }
  return map[status] || map.draft
}

export function getApprovalStatusLabel(status: ApprovalStatus | string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    needs_revision: 'Needs Revision',
  }
  return map[status] || 'Draft'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ── Skill Categories ────────────────────────────────────────────────────

export const SKILL_CATEGORIES = [
  'Marketing', 'PRD', 'SEO', 'Proposal', 'Sales', 'Website Audit', 'AI Automation', 'Custom'
] as const

export const PROMPT_CATEGORIES = [
  'Marketing', 'PRD', 'SEO', 'Proposal', 'Sales', 'Website Audit', 'AI Automation', 'Custom'
] as const

export const KB_FOLDERS = [
  'Brand Guidelines', 'Development Standards', 'Marketing SOPs', 'Sales SOPs', 'Client Templates', 'Documentation', 'General'
] as const

export const WORKFLOW_STEPS = [
  { step: 1, label: 'Fill Details', icon: 'edit' },
  { step: 2, label: 'Generate Prompt', icon: 'sparkles' },
  { step: 3, label: 'Download Skill', icon: 'download' },
  { step: 4, label: 'Open Claude', icon: 'external-link' },
  { step: 5, label: 'Generate Doc', icon: 'file-text' },
  { step: 6, label: 'Upload PDF', icon: 'upload' },
  { step: 7, label: 'Store in ERP', icon: 'check-circle' },
] as const
