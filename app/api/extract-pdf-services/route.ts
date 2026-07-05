import { NextRequest, NextResponse } from 'next/server'

// Force Node.js runtime (pdfjs-dist needs Node APIs, not Edge runtime)
export const runtime = 'nodejs'

// ── PDF text extraction using pdfjs-dist ────────────────────────────────────
async function extractTextFromBuffer(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  try {
    // Import the internal library file directly to avoid the known pdf-parse@1.1.1 bug
    // where it tries to open a non-existent test file on first load in Next.js
    // eslint-disable-next-line
    const pdfParseLib = require('pdf-parse/lib/pdf-parse.js')
    const pdfParseFunc = typeof pdfParseLib === 'function' ? pdfParseLib : pdfParseLib.default
    if (typeof pdfParseFunc !== 'function') {
      throw new Error('pdf-parse internal module did not export a callable function')
    }
    const data = await pdfParseFunc(buffer)
    return { text: data.text || '', numpages: data.numpages || 0 }
  } catch (error: any) {
    console.error('[PDF Parse error]', error?.message || error)
    throw new Error(`Failed to parse PDF: ${error?.message || 'unknown error'}`)
  }
}

// ── Category detection ────────────────────────────────────────────────────────
function detectCategory(text: string): string {
  const t = text.toLowerCase()
  if (/website|web\b|shopify|wordpress|woocommerce|ecommerce|e-commerce|landing page|portfolio/.test(t)) return '1'
  if (/social media|instagram|facebook|smm|posts?\/month|content calendar/.test(t)) return '2'
  if (/meta ads|google ads|facebook ads|ppc|paid ads|advertising|sponsored/.test(t)) return '3'
  if (/seo|google maps|gmb|search engine|local seo|keyword/.test(t)) return '4'
  if (/whatsapp|automation|bot|waba|crm setup|workflow|chatbot/.test(t)) return '5'
  if (/brand|logo|identity|design|graphic|ui\/ux|branding/.test(t)) return '6'
  if (/content|reel|video|copywriting|script|email/.test(t)) return '7'
  if (/analytics|dashboard|report|crm|tracking|google business/.test(t)) return '8'
  return '1'
}

function parseServices(rawText: string) {
  const services: Array<{
    name: string
    pricing: string
    basePrice: number
    priceMin?: number
    priceMax?: number
    quotationPrice?: number
    catId: string
    timeline: string
    deliverables: string[]
    exclusions: string[]
    status: string
  }> = []

  const text = rawText.replace(/\r\n/g, '\n')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const priceRe = /(?:(?:INR|Rs\.?|₹)\s*)?([\d,]+)\s*(?:\/\-|\/mo|per month|month|one-time|one time)?/gi
  const monthlyKw = /monthly|recurring|per month|\/mo|\bmo\b|retainer/i

  // 1. Identify service boundaries strictly by numbered format (01. Service Name or 01.)
  const serviceBlocks: { name: string, startIdx: number, endIdx: number }[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Matches "01. Service Name" or just "01."
    const match = line.match(/^(\d{1,2})\.\s*(.*)$/)
    if (match) {
      let serviceName = match[2].trim()
      
      // If pattern B (just number), take the next line as the name
      if (!serviceName && i + 1 < lines.length) {
        serviceName = lines[i + 1]
      }
      
      if (serviceName) {
        // If there's a previous block, cap its endIdx
        if (serviceBlocks.length > 0) {
          serviceBlocks[serviceBlocks.length - 1].endIdx = i
        }
        
        serviceBlocks.push({
          name: serviceName,
          startIdx: i,
          endIdx: lines.length // Default to end of file, will be capped by next service
        })
        console.log(`\n[DEBUG] Service Start Found:\n${line}`)
      }
    }
  }

  // 2. Process each strictly bounded block
  for (const block of serviceBlocks) {
    const blockLines = lines.slice(block.startIdx, block.endIdx)
    const ctx = blockLines.join(' ')

    // Extract all prices in this bounded block
    const priceMatches: number[] = []
    let pm: RegExpExecArray | null
    priceRe.lastIndex = 0
    while ((pm = priceRe.exec(ctx)) !== null) {
      const raw = pm[1].replace(/,/g, '')
      const val = parseInt(raw, 10)
      if (!isNaN(val) && val >= 999 && val <= 9_999_999) {
        priceMatches.push(val)
      }
    }

    if (priceMatches.length === 0) continue

    // Handle Pricing Ranges
    const uniquePrices = Array.from(new Set(priceMatches)).sort((a, b) => a - b)
    const priceMin = uniquePrices[0]
    const priceMax = uniquePrices[uniquePrices.length - 1]
    const quotationPrice = priceMax // Per requirements, use highest value for quotation

    console.log(`[DEBUG] Price Found:\n${priceMin === priceMax ? `₹${priceMin}` : `₹${priceMin} - ₹${priceMax}`}`)

    const hasRecurring = /\/mo|per month|monthly/i.test(ctx)
    const pricing = hasRecurring ? 'monthly' : 'fixed'

    // Extract deliverables
    const deliverables: string[] = []
    for (const dl of blockLines) {
      if (/^[•\-\*✓✔►▶]/.test(dl) || /^•/.test(dl)) {
        const clean = dl.replace(/^[•\-\*✓✔►▶]\s*/, '').trim()
        if (clean.length > 2 && clean.length < 120 && !/included|deliverable/i.test(clean)) {
          deliverables.push(clean)
        }
      }
    }

    // Extract timeline
    let timeline = ''
    const timelineMatch = ctx.match(/timeline[:\s]+([^•\n]{3,40})/i)
    if (timelineMatch) {
      timeline = timelineMatch[1].trim().replace(/\s+/g, ' ').slice(0, 40)
    } else if (/ongoing/i.test(ctx.slice(0, 200))) {
      timeline = 'Ongoing'
    }
    console.log(`[DEBUG] Timeline Found:\n${timeline || 'None'}`)

    const cleanName = block.name.replace(/[^\w\s()\-./&+,!@#%:'"]/g, '').trim().slice(0, 120)
    
    services.push({
      name: cleanName,
      pricing,
      basePrice: priceMin, // Store the lowest as base for UI preview
      priceMin,
      priceMax,
      quotationPrice,
      catId: detectCategory(cleanName + ' ' + ctx.slice(0, 200)),
      timeline,
      deliverables,
      exclusions: [],
      status: 'draft',
    })
    
    console.log(`[DEBUG] Service Saved:\n${cleanName}`)
  }

  return services
}

// ── API Route ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 400 })
    }

    // Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text with pdfjs-dist
    const { text: rawText, numpages } = await extractTextFromBuffer(buffer)

    if (!rawText.trim()) {
      return NextResponse.json({
        services: [],
        pageCount: numpages,
        charCount: 0,
        warning: 'This PDF appears to be image-based or scanned. No extractable text was found. Please add services manually.',
      })
    }

    const services = parseServices(rawText)

    return NextResponse.json({
      services,
      pageCount: numpages,
      charCount: rawText.length,
    })
  } catch (err: any) {
    console.error('[extract-pdf-services]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to parse PDF' },
      { status: 500 }
    )
  }
}
