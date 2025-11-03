import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/middleware'
import { supabase } from '@/lib/supabase/client'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js/node'
import { PDFDocument } from 'pdf-lib'
import React from 'react'
import fontData from '@/lib/fonts/inter-400-base64'

type SlideProps = {
  h1: string
  h2?: string
  caption?: string
}

type AssetInsert = {
  job_id: string
  type: 'image' | 'pdf'
  url: string
  meta: Record<string, unknown>
}

/**
 * Genera il Virtual DOM React compatibile con Satori
 * (niente JSX diretto per evitare parsing error nei file API)
 */
function slideVNode({ h1, h2, caption }: SlideProps) {
  return React.createElement(
    'div',
    {
      style: {
        width: '1080px',
        height: '1080px',
        display: 'flex',
        flexDirection: 'column',
        padding: '80px',
        backgroundColor: '#fff',
        fontFamily: 'Inter',
      },
    },
    React.createElement('h1', { style: { fontSize: '72px', marginBottom: '20px' } }, h1),
    h2 && React.createElement('h2', { style: { fontSize: '40px', marginBottom: '20px' } }, h2),
    caption && React.createElement('p', { style: { fontSize: '32px', color: '#666' } }, caption)
  )
}

/**
 * Renderizza una singola slide (SVG + PNG buffer)
 */
async function renderSlideToPngBuffer(slide: SlideProps) {
  const svg = await satori(slideVNode(slide), {
    width: 1080,
    height: 1080,
    fonts: [
      {
        name: 'Inter',
        data: Buffer.from(fontData, 'base64'),
        style: 'normal',
      },
    ],
  })

  const pngBuffer = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1080 },
  })
    .render()
    .asPng()

  return { svg, pngBuffer }
}

/**
 * Crea un PDF da una lista di immagini PNG
 */
async function createPdfFromImages(images: Uint8Array[]) {
  const pdfDoc = await PDFDocument.create()
  for (const img of images) {
    const pngImage = await pdfDoc.embedPng(img)
    const page = pdfDoc.addPage([pngImage.width, pngImage.height])
    page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height })
  }
  return await pdfDoc.save()
}

/**
 * Helper JSON tipato (rimuove tutti i `any`)
 */
function json<T>(data: T, init?: ResponseInit | number): NextResponse {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init)
}

/**
 * Endpoint principale per generare caroselli
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req)
  if (auth.status !== 200) return auth
  const { userId } = await auth.json()

  try {
    const { jobId, payload }: { jobId: string; payload: { slides: SlideProps[] } } = await req.json()
    const slides = payload?.slides
    if (!jobId || !slides?.length) {
      return json({ error: 'INVALID_PAYLOAD' }, 400)
    }

    const pngs: Uint8Array[] = []
    const urls: string[] = []

    for (let i = 0; i < slides.length; i++) {
      const { pngBuffer } = await renderSlideToPngBuffer(slides[i])
      const path = `public/${userId}/${jobId}/slide-${i + 1}.png`

      const { error } = await supabase.storage.from('assets').upload(path, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      })
      if (error) throw new Error('UPLOAD_FAIL')

      const { data: url } = supabase.storage.from('assets').getPublicUrl(path)
      urls.push(url.publicUrl)
      pngs.push(pngBuffer)
    }

    // Genera il PDF da tutte le slide PNG
    const pdfBuffer = await createPdfFromImages(pngs)
    const pdfPath = `public/${userId}/${jobId}/carousel.pdf`

    await supabase.storage.from('assets').upload(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    const { data: pdfUrl } = supabase.storage.from('assets').getPublicUrl(pdfPath)

    const assetRecords: AssetInsert[] = urls.map((url, i) => ({
      job_id: jobId,
      type: 'image',
      url,
      meta: { index: i + 1 },
    }))

    // Aggiunge il PDF come asset finale
    assetRecords.push({
      job_id: jobId,
      type: 'pdf',
      url: pdfUrl.publicUrl,
      meta: {
        index: 0,
        format: 'carousel',
        slides: slides.length,
      },
    })

    await supabase.from('assets').insert(assetRecords)
    await supabase.from('jobs').update({ status: 'ok', progress: 100 }).eq('id', jobId)

    return json({
      ok: true,
      assets: urls,
      pdf: pdfUrl.publicUrl,
    })
  } catch (e) {
    console.error('CAROUSEL_ERROR', e)
    return json({ error: 'INTERNAL_ERROR' }, 500)
  }
}
