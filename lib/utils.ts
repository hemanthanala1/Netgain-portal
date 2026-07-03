import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return 'INR ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}


export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a')
}

export function generateDocId(prefix: string): string {
  const year = new Date().getFullYear()
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${year}-${rand}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getLeadStatusColor(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    contacted: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    proposal_sent: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    quotation_sent: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    negotiation: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    won: 'bg-green-500/10 text-green-400 border-green-500/20',
    lost: 'bg-red-500/10 text-red-400 border-red-500/20',
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
}

export function getDocStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    paid: 'bg-green-500/10 text-green-400 border-green-500/20',
    overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    signed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    expired: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    'internal review': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    viewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    archived: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
}

