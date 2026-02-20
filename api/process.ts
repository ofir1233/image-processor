import type { VercelRequest, VercelResponse } from '@vercel/node'
import Groq from 'groq-sdk'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageData, mimeType } = req.body ?? {}

  if (!imageData || !mimeType) {
    return res.status(400).json({ error: 'Missing imageData or mimeType' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server' })
  }

  try {
    const groq = new Groq({ apiKey })

    const prompt = `You are an expert SVG artist and animator.
Analyze the provided image and create a beautiful, self-contained animated SVG inspired by its content, colors, shapes, and mood.

Requirements:
- Output a single complete SVG element with a viewBox (e.g. viewBox="0 0 800 600")
- Use CSS @keyframes animations defined inside a <style> block within the SVG
- Faithfully reflect the key visual elements, palette, and atmosphere of the image
- Make the animation smooth, creative, and visually appealing
- All styles must be inline inside the SVG — no external resources

CRITICAL: Reply with ONLY the raw SVG markup. Start with <svg and end with </svg>. No markdown, no code fences, no explanation.`

    const response = await groq.chat.completions.create({
      model: 'llama-3.2-11b-vision-instruct',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageData}` },
            },
          ],
        },
      ],
    })

    let svg = (response.choices[0].message.content ?? '').trim()

    // Strip markdown code fences if the model added them
    svg = svg.replace(/^```(?:svg|xml)?\s*/i, '').replace(/\s*```$/, '').trim()

    if (!svg.startsWith('<svg')) {
      return res.status(500).json({ error: 'Model did not return a valid SVG', raw: svg.slice(0, 300) })
    }

    return res.status(200).json({ svg })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Groq API error:', message)
    return res.status(500).json({ error: message })
  }
}
