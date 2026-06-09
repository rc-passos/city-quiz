import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt')
  if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

  const token = process.env.HF_TOKEN
  if (!token) return NextResponse.json({ error: 'HF_TOKEN missing' }, { status: 500 })

  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
        // @ts-expect-error - Node 18 fetch option
        signal: AbortSignal.timeout(50000),
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

    if (res.status === 503) {
      return NextResponse.json({ error: 'Model loading, please retry in 20s' }, { status: 503 })
    }

    const body = await res.text()
    return NextResponse.json({ error: `HF ${res.status}: ${body}` }, { status: 500 })

  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    const cause = (err as NodeJS.ErrnoException).cause
    return NextResponse.json({
      error: `${err.message}`,
      cause: cause ? String(cause) : undefined,
    }, { status: 500 })
  }
}
