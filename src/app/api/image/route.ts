import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get('prompt')
  if (!prompt) return NextResponse.json({ error: 'No prompt' }, { status: 400 })

  const token = process.env.HF_TOKEN
  if (!token) return NextResponse.json({ error: 'No HF_TOKEN configured' }, { status: 500 })

  // Retry up to 3 times to handle model cold-start (503)
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
    console.error(`HF attempt ${attempt + 1} failed: status=${res.status} body=${errText}`)

    if (res.status === 503) {
      await new Promise(r => setTimeout(r, 8000))
      continue
    }

    return NextResponse.json({ error: `status=${res.status} ${errText}` }, { status: res.status })
  }

  return NextResponse.json({ error: 'Model unavailable after retries' }, { status: 503 })
}
