import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt')
  if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

  const token = process.env.HF_TOKEN
  if (!token) return NextResponse.json({ error: 'HF_TOKEN missing' }, { status: 500 })

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { num_inference_steps: 4 },
          }),
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
        await new Promise(r => setTimeout(r, 8000))
        continue
      }

      return NextResponse.json(
        { error: `HF status=${res.status}: ${errText}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: 'Model still loading after retries' }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: `Exception: ${String(e)}` }, { status: 500 })
  }
}
