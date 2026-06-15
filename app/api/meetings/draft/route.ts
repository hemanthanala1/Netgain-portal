import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto-helper'

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`
}
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null

// Direct lightweight fetch call to Gemini
async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Gemini API call failed')
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!supabase || !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientName, eventType, notes, channel, tone } = body

    if (!clientName || !eventType) {
      return NextResponse.json({ error: 'Client name and meeting event type are required' }, { status: 400 })
    }

    // Retrieve AI configuration
    const { data: settings } = await supabase
      .from('company_settings')
      .select('ai')
      .eq('user_id', user.id)
      .maybeSingle()

    const ai = settings?.ai || {}
    let geminiKey = decrypt(ai.geminiKey || '')
    if (!geminiKey) {
      geminiKey = process.env.GEMINI_API_KEY || ''
    }

    const promptText = `
      You are an AI assistant for Netgain Studio ERP.
      Draft a follow-up ${channel} message to the client.
      - Client Name: ${clientName}
      - Meeting Type: ${eventType}
      - Meeting Notes: ${notes || 'No notes provided. Follow up to check if they have any questions and thank them for their time.'}
      - Target Tone: ${tone || 'professional'}
      - Channel: ${channel} (Email, WhatsApp, or SMS)

      Guidelines:
      - If Channel is Email, include a Subject line on the very first line starting with "Subject: ".
      - Keep it concise, friendly, and structured. Use paragraphs or bullet points if necessary.
      - Do not include placeholders like "[Your Name]". Instead, sign off with "Netgain Team".
      - Ensure the message content matches the tone and summarizes any key action items or next steps mentioned in the notes.
      
      Respond with ONLY the final drafted message.
    `

    let draftContent = ''
    if (!geminiKey || geminiKey.startsWith('mock_')) {
      // High-quality Fallback template generator if API key is not configured
      console.log('[MOCK DRAFT GENERATOR] Generating template-based follow-up...')
      if (channel === 'email') {
        draftContent = `Subject: Follow up: ${eventType} - Netgain Team\n\nDear ${clientName},\n\nThank you for taking the time to meet with us for the ${eventType}.\n\nBased on our discussion:\n${notes ? '- ' + notes.replace(/\n/g, '\n- ') : '- We discussed your current project requirements and goals.'}\n\nWe will get back to you with the next steps shortly. Please let us know if you have any questions in the meantime.\n\nBest regards,\nNetgain Team`
      } else if (channel === 'whatsapp') {
        draftContent = `Hi ${clientName}, thanks for your time today during the ${eventType}! 🚀\n\nNotes from our chat:\n${notes ? '• ' + notes.replace(/\n/g, '\n• ') : '• We aligned on project scope and deliverables.'}\n\nWe will share the proposal soon. Let us know if you have any questions! - Netgain Team`
      } else {
        draftContent = `Hi ${clientName}, thanks for meeting with us today for the ${eventType}. Notes: ${notes || 'We will share the next steps soon.'} - Netgain Team`
      }
    } else {
      draftContent = await callGemini(geminiKey, promptText)
    }

    return NextResponse.json({ success: true, draft: draftContent.trim() })
  } catch (err: any) {
    console.error('Draft generation error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
