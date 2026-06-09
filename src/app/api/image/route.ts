import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt')
  if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

  const token = process.env.HF_TOKEN
  if (!token) return NextResponse.json({ error: 'HF_TOKEN missing' }, { status: 500 })

  const models = [
    'stabilityai/stable-diffusion-xl-base-1.0',
    'runwayml/stable-diffusion-v1-5',
  ]

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://api-inference.huggingface.co/models/${model}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: prompt }),
          }
        )

        if (res.ok) {
          const buffer = await res.arrayBuffer()
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          })
        }

        const errText = await res.text()

        if (res.status === 503) {
          await new Promise(r => setTimeout(r, 10000))
          continue
        }

        // Try next model on non-503 errors
        break
      } catch (e) {
        if (attempt === 1) break
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  return NextResponse.json({ error: 'All models failed' }, { status: 500 })
}
