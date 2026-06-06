import React from 'react'
import { NextResponse } from 'next/server'
import { renderToStream } from '@react-pdf/renderer'
import { SampleServicesPDF } from '@/lib/sample-services-pdf'
import { PassThrough } from 'stream'

export async function GET() {
  try {
    const stream = await renderToStream(React.createElement(SampleServicesPDF))
    
    // Convert the stream to a Response-compatible stream
    const passThrough = new PassThrough()
    stream.pipe(passThrough)

    // @ts-ignore - Next.js handles Node streams in responses
    return new NextResponse(passThrough, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="NBOS-Sample-Services-Template.pdf"',
      },
    })
  } catch (error) {
    console.error('Error generating sample services PDF:', error)
    return new NextResponse('Error generating PDF', { status: 500 })
  }
}
