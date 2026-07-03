import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

const TABLE_MAP: Record<string, string> = {
  Quotation: 'quotations',
  Invoice: 'invoices',
  SOW: 'sows',
  Agreement: 'agreements',
  PRD: 'prds',
  Marketing: 'marketing_reports',
  Proposal: 'proposals',
  Contract: 'contracts'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, id, type, notes, approver, userId, targetVersion } = body

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 500 })
    }

    if (!action || !id || !type) {
      return NextResponse.json({ error: 'Missing required parameters: action, id, type' }, { status: 400 })
    }

    const tableName = TABLE_MAP[type]
    if (!tableName) {
      return NextResponse.json({ error: `Unsupported document type: ${type}` }, { status: 400 })
    }

    // 1. Fetch current document record
    const { data: docRecord, error: docError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (docError || !docRecord) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const currentVersion = docRecord.version || 1
    const username = approver || userId || 'System'

    // 2. Perform the requested action
    switch (action) {
      case 'log_timeline': {
        const { error: timelineErr } = await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'viewed',
          user_name: username,
          notes: notes || 'Client opened and viewed the document.'
        })
        if (timelineErr) throw timelineErr

        // Transition Sent to Client -> Viewed
        if (docRecord.status && docRecord.status.toLowerCase() === 'sent to client') {
          const targetHistory = [
            ...(docRecord.history || []),
            { date: new Date().toISOString().split('T')[0], action: 'Document viewed by client' }
          ]
          const { error: updateErr } = await supabase
            .from(tableName)
            .update({ status: 'Viewed', history: targetHistory })
            .eq('id', id)
          if (updateErr) throw updateErr
        }
        return NextResponse.json({ success: true })
      }
      case 'request_approval': {
        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: 'Submitted for Internal Review' }
        ]

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'internal_review',
          user_name: username,
          notes: notes || 'Submitted for internal review.'
        })

        const { error } = await supabase
          .from(tableName)
          .update({ status: 'Internal Review', history: targetHistory })
          .eq('id', id)

        if (error) throw error
        break
      }

      case 'approve': {
        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: `Approved by ${username}` }
        ]

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'approved',
          user_name: username,
          notes: notes || 'Document approved internally.'
        })

        await supabase.from('document_approvals').insert({
          document_type: type,
          document_id: id,
          approver: username,
          status: 'approved',
          notes: notes || 'Approved.'
        })

        const { error } = await supabase
          .from(tableName)
          .update({ status: 'Approved', history: targetHistory })
          .eq('id', id)

        if (error) throw error
        break
      }

      case 'reject':
      case 'request_revision': {
        const isReject = action === 'reject'
        const nextStatus = 'Needs Revision'
        const eventType = 'revision_requested'

        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: `Revision requested by ${username}` }
        ]

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: eventType,
          user_name: username,
          notes: notes || 'Revision requested.'
        })

        await supabase.from('document_approvals').insert({
          document_type: type,
          document_id: id,
          approver: username,
          status: isReject ? 'rejected' : 'revision_requested',
          notes: notes || 'Revision requested.'
        })

        const { error } = await supabase
          .from(tableName)
          .update({ status: nextStatus, history: targetHistory })
          .eq('id', id)

        if (error) throw error
        break
      }

      case 'send_for_signature': {
        // Generate secure 48-char hex token
        const token = crypto.randomBytes(24).toString('hex')
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

        // Deactivate previous active tokens for this document
        await supabase
          .from('document_tokens')
          .update({ status: 'expired' })
          .eq('document_type', type)
          .eq('document_id', id)
          .eq('status', 'active')

        // Insert new token
        const { error: tokenErr } = await supabase
          .from('document_tokens')
          .insert({
            document_type: type,
            document_id: id,
            token,
            expires_at: expiresAt.toISOString(),
            created_by: username
          })

        if (tokenErr) throw tokenErr

        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: 'Sent to client for e-signature' }
        ]

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'sent',
          user_name: username,
          notes: 'Secure signing link generated.'
        })

        const { error } = await supabase
          .from(tableName)
          .update({ status: 'Sent to Client', history: targetHistory })
          .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true, token, expiresAt: expiresAt.toISOString() })
      }

      case 'cancel_signing': {
        // Cancel active tokens
        await supabase
          .from('document_tokens')
          .update({ status: 'cancelled' })
          .eq('document_type', type)
          .eq('document_id', id)
          .eq('status', 'active')

        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: 'Signing link cancelled' }
        ]

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'approved',
          user_name: username,
          notes: 'Active signature signing links cancelled.'
        })

        const { error } = await supabase
          .from(tableName)
          .update({ status: 'Approved', history: targetHistory })
          .eq('id', id)

        if (error) throw error
        break
      }

      case 'create_version': {
        // Backup current document as the current version
        const { error: verErr } = await supabase
          .from('document_versions')
          .insert({
            document_type: type,
            document_id: id,
            version: currentVersion,
            document_data: docRecord,
            created_by: username
          })

        if (verErr && !verErr.message.includes('duplicate key')) {
          throw verErr
        }

        const nextVersion = currentVersion + 1
        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: `New Version ${nextVersion} created` }
        ]

        // Reset status to Draft for revision, unlock and increment version
        const { error } = await supabase
          .from(tableName)
          .update({
            status: 'draft',
            version: nextVersion,
            is_locked: false,
            history: targetHistory
          })
          .eq('id', id)

        if (error) throw error

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'created',
          user_name: username,
          notes: `Version ${nextVersion} initialized.`
        })

        return NextResponse.json({ success: true, newVersion: nextVersion })
      }

      case 'restore_version': {
        if (!targetVersion) {
          return NextResponse.json({ error: 'Missing target version' }, { status: 400 })
        }

        // Fetch target version data
        const { data: verRecord, error: verErr } = await supabase
          .from('document_versions')
          .select('*')
          .eq('document_type', type)
          .eq('document_id', id)
          .eq('version', targetVersion)
          .maybeSingle()

        if (verErr || !verRecord) {
          return NextResponse.json({ error: `Version ${targetVersion} not found` }, { status: 404 })
        }

        // Save current state as version backup
        await supabase
          .from('document_versions')
          .insert({
            document_type: type,
            document_id: id,
            version: currentVersion,
            document_data: docRecord,
            created_by: username
          })

        const restoredData = verRecord.document_data
        const nextVersion = currentVersion + 1
        const targetHistory = [
          ...(docRecord.history || []),
          { date: new Date().toISOString().split('T')[0], action: `Restored back to Version ${targetVersion}` }
        ]

        // Merge restored fields with next version number
        const updatedFields = {
          ...restoredData,
          id, // Keep the same primary key
          version: nextVersion,
          status: 'draft',
          is_locked: false,
          history: targetHistory
        }

        // Remove system dates to prevent overwrite conflicts if necessary
        delete updatedFields.created_at

        const { error } = await supabase
          .from(tableName)
          .update(updatedFields)
          .eq('id', id)

        if (error) throw error

        await supabase.from('document_timeline').insert({
          document_type: type,
          document_id: id,
          event: 'created',
          user_name: username,
          notes: `Restored Version ${targetVersion} as active Version ${nextVersion}.`
        })

        return NextResponse.json({ success: true, restoredVersion: nextVersion })
      }

      case 'get_versions': {
        const { data: versions, error } = await supabase
          .from('document_versions')
          .select('*')
          .eq('document_type', type)
          .eq('document_id', id)
          .order('version', { ascending: false })

        if (error) throw error
        return NextResponse.json({ success: true, versions })
      }

      case 'get_timeline': {
        const { data: timeline, error } = await supabase
          .from('document_timeline')
          .select('*')
          .eq('document_type', type)
          .eq('document_id', id)
          .order('created_at', { ascending: true })

        if (error) throw error
        return NextResponse.json({ success: true, timeline })
      }

      default:
        return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DOCUMENT ACTIONS API]', err)
    return NextResponse.json(
      { error: err?.message || 'Operation failed' },
      { status: 500 }
    )
  }
}
