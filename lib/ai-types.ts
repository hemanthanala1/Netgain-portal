// ── AI Hub TypeScript Types ──────────────────────────────────────────────

export type ApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_revision'
export type SkillStatus = 'active' | 'archived' | 'draft'
export type PromptCategory = 'Marketing' | 'PRD' | 'SEO' | 'Proposal' | 'Sales' | 'Website Audit' | 'AI Automation' | 'Custom'
export type SkillCategory = 'Marketing' | 'PRD' | 'SEO' | 'Proposal' | 'Sales' | 'Website Audit' | 'AI Automation' | 'Custom'
export type NotificationType = 'info' | 'success' | 'warning' | 'skill_update' | 'approval' | 'document'

export type KBFolder = 'Brand Guidelines' | 'Development Standards' | 'Marketing SOPs' | 'Sales SOPs' | 'Client Templates' | 'Documentation' | 'General'

// ── Skills ───────────────────────────────────────────────────────────────

export interface Skill {
  id: string
  name: string
  description: string
  category: SkillCategory
  current_version: string
  compatible_ai: string
  compatible_version: string
  file_name: string
  file_size: number
  file_url: string
  downloads: number
  status: SkillStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface SkillVersion {
  id: string
  skill_id: string
  version: string
  release_notes: string
  file_name: string
  file_size: number
  file_url: string
  status: string
  created_by: string
  created_at: string
}

// ── Prompts ─────────────────────────────────────────────────────────────

export interface Prompt {
  id: string
  title: string
  description: string
  category: PromptCategory
  content: string
  tags: string[]
  current_version: number
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface PromptVersion {
  id: string
  prompt_id: string
  version: number
  content: string
  change_note: string
  created_by: string
  created_at: string
}

// ── Knowledge Base ──────────────────────────────────────────────────────

export interface KnowledgeBaseItem {
  id: string
  title: string
  description: string
  folder: KBFolder
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  tags: string[]
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

// ── AI Providers ────────────────────────────────────────────────────────

export interface AIProvider {
  id: string
  name: string
  description: string
  icon: string
  status: string
  api_key_configured: boolean
  config: Record<string, any>
  created_at: string
}

// ── Documents ───────────────────────────────────────────────────────────

export interface AIDocument {
  id: string
  doc_id: string
  title: string
  client: string
  project: string
  module: string
  document_type: string
  prompt_used: string
  skill_version: string
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  generated_by: string
  current_version: number
  approval_status: ApprovalStatus
  approver: string
  approver_notes: string
  approval_date: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface AIDocumentVersion {
  id: string
  document_id: string
  version: number
  file_name: string
  file_url: string
  change_note: string
  created_by: string
  created_at: string
}

// ── Approvals ───────────────────────────────────────────────────────────

export interface Approval {
  id: string
  entity_type: string
  entity_id: string
  entity_title: string
  status: ApprovalStatus
  requested_by: string
  requested_at: string
  reviewed_by: string
  reviewed_at: string
  notes: string
  history: { date: string; action: string; by: string }[]
  created_at: string
}

// ── Notifications ───────────────────────────────────────────────────────

export interface AINotification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  entity_type: string
  entity_id: string
  is_read: boolean
  created_at: string
}

// ── Strategy Engine Types ───────────────────────────────────────────────

export interface CampaignStrategyForm {
  businessName: string
  businessCategory: string
  website: string
  phone: string
  email: string
  location: string
  businessDescription: string
  products: string
  services: string
  offers: string
  competitors: string
  currentMarketing: string
  monthlyBudget: string
  platformBudget: string
  targetAudience: string
  businessGoals: string
  timeline: string
  notes: string
}

// ── Blueprint Engine Types ──────────────────────────────────────────────

export interface BlueprintForm {
  productName: string
  projectType: string
  targetUsers: string
  objectives: string
  features: string
  modules: string
  userRoles: string
  platform: string
  timeline: string
  budget: string
  integrations: string
  authentication: string
  payments: string
  notifications: string
  aiFeatures: string
  security: string
  performance: string
  techStack: string
  database: string
  apis: string
}

// ── Marketing Intelligence Types ────────────────────────────────────────

export interface MarketingIntelligenceForm {
  client: string
  period: string
  channels: string[]
  uploadedFiles: { name: string; type: string; size: number }[]
  metaSpend: string
  metaRevenue: string
  metaLeads: string
  metaImpressions: string
  metaROAS: string
  googleSpend: string
  googleRevenue: string
  googleClicks: string
  googleConversions: string
  seoRanking: string
  seoTraffic: string
  seoKeywords: string
  summary: string
  insights: string
  recommendations: string
  nextPlan: string
}
