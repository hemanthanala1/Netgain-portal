import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''

  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, results: {} })
  }

  try {
    const term = `%${q}%`
    
    // We execute queries in parallel with custom catch blocks for safety
    const [
      clientsRes,
      projectsRes,
      quotationsRes,
      invoicesRes,
      agreementsRes,
      sowsRes,
      meetingsRes,
      ticketsRes,
      servicesRes,
      profilesRes,
      teamRes,
      filesRes
    ] = await Promise.all([
      supabase.from('clients').select('id, name, company').or(`name.ilike.${term},company.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('projects').select('id, doc_id, title, client').or(`title.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('quotations').select('id, doc_id, client').or(`doc_id.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('invoices').select('id, doc_id, client').or(`doc_id.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('agreements').select('id, doc_id, client').or(`doc_id.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('sow').select('id, doc_id, client').or(`doc_id.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('meetings').select('id, event_type, meeting_date, client').or(`event_type.ilike.${term},client.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('client_notifications').select('id, title, message').eq('type', 'support').or(`title.ilike.${term},message.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('services').select('id, name').ilike('name', term).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('profiles').select('id, full_name, email').or(`full_name.ilike.${term},email.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('team_members').select('id, name, role, email').or(`name.ilike.${term},role.ilike.${term},email.ilike.${term}`).limit(5).then(res => res, () => ({ data: null })),
      supabase.from('project_files').select('id, name, category, file_path').or(`name.ilike.${term},category.ilike.${term}`).limit(5).then(res => res, () => ({ data: null }))
    ])

    const results: Record<string, any[]> = {}

    if (clientsRes.data && clientsRes.data.length > 0) {
      results['Clients'] = clientsRes.data.map((c: any) => ({
        id: c.id,
        title: c.name,
        subtitle: `Company: ${c.company}`,
        link: `/crm/${c.id}`
      }))
    }
    
    if (projectsRes.data && projectsRes.data.length > 0) {
      results['Projects'] = projectsRes.data.map((p: any) => ({
        id: p.id,
        title: p.title,
        subtitle: `Client: ${p.client} (${p.doc_id || 'No ID'})`,
        link: `/projects?projectId=${p.id}`
      }))
    }

    if (quotationsRes.data && quotationsRes.data.length > 0) {
      results['Quotations'] = quotationsRes.data.map((q: any) => ({
        id: q.id,
        title: q.doc_id,
        subtitle: `Client: ${q.client}`,
        link: `/documents/quotations`
      }))
    }

    if (invoicesRes.data && invoicesRes.data.length > 0) {
      results['Invoices'] = invoicesRes.data.map((i: any) => ({
        id: i.id,
        title: i.doc_id,
        subtitle: `Client: ${i.client}`,
        link: `/documents/invoices`
      }))
    }

    if (agreementsRes.data && agreementsRes.data.length > 0) {
      results['Agreements'] = agreementsRes.data.map((a: any) => ({
        id: a.id,
        title: a.doc_id,
        subtitle: `Client: ${a.client}`,
        link: `/documents/agreements`
      }))
    }

    if (sowsRes.data && sowsRes.data.length > 0) {
      results['SOWs'] = sowsRes.data.map((s: any) => ({
        id: s.id,
        title: s.doc_id,
        subtitle: `Client: ${s.client}`,
        link: `/documents/sow`
      }))
    }

    if (meetingsRes.data && meetingsRes.data.length > 0) {
      results['Meetings'] = meetingsRes.data.map((m: any) => ({
        id: m.id,
        title: m.event_type || 'Consultation Meeting',
        subtitle: `Date: ${m.meeting_date} (Client: ${m.client})`,
        link: `/meetings`
      }))
    }

    if (ticketsRes.data && ticketsRes.data.length > 0) {
      results['Support Tickets'] = ticketsRes.data.map((t: any) => ({
        id: t.id,
        title: t.title,
        subtitle: t.message ? (t.message.slice(0, 60) + '...') : 'Support Ticket',
        link: `/support`
      }))
    }

    if (servicesRes.data && servicesRes.data.length > 0) {
      results['Services'] = servicesRes.data.map((s: any) => ({
        id: s.id,
        title: s.name,
        subtitle: 'Services Catalog item',
        link: `/services`
      }))
    }

    // Merge profiles and team members
    const teamItems: any[] = []
    const seenTeamEmails = new Set()
    if (profilesRes.data) {
      profilesRes.data.forEach((p: any) => {
        seenTeamEmails.add(p.email)
        teamItems.push({
          id: p.id,
          title: p.full_name,
          subtitle: `Profile: ${p.email}`,
          link: `/team`
        })
      })
    }
    if (teamRes.data) {
      teamRes.data.forEach((t: any) => {
        if (!seenTeamEmails.has(t.email)) {
          teamItems.push({
            id: t.id,
            title: t.name,
            subtitle: `${t.role || 'Member'} (${t.email || ''})`,
            link: `/team`
          })
        }
      })
    }
    if (teamItems.length > 0) {
      results['Team Members'] = teamItems
    }

    if (filesRes.data && filesRes.data.length > 0) {
      results['Files'] = filesRes.data.map((f: any) => ({
        id: f.id,
        title: f.name,
        subtitle: `Category: ${f.category}`,
        link: f.file_path || '#'
      }))
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('Global search endpoint failure:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
