import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const SETTINGS_PATH = path.join(process.cwd(), '.nbos-settings.json')

// GET — load settings
export async function GET() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
      return NextResponse.json(JSON.parse(raw))
    }
    return NextResponse.json({})
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST — save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Merge with existing settings so partial updates don't wipe other sections
    let existing: any = {}
    if (fs.existsSync(SETTINGS_PATH)) {
      existing = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
    const merged = { ...existing, ...body, updatedAt: new Date().toISOString() }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
