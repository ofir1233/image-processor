import type { VercelRequest, VercelResponse } from '@vercel/node'
import Groq from 'groq-sdk'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
}

const SYSTEM_PROMPT = `You are a Master SVG Architect — a fusion of visual artist, motion designer, and vector engineer.

Before writing a single line of SVG code, you MUST silently reason through four steps:

═══════════════════════════════════════════
STEP 1 — VISION ANALYSIS
═══════════════════════════════════════════
Observe the image deeply. Identify:
• Core geometry: dominant shapes (circles, lines, curves, grids, organic blobs)
• Primary color palette: extract 4–6 hex colors that define the image's soul
• Aesthetic mood: choose one — Organic Flow | Technological Precision | Celestial Pulse | Urban Tension | Natural Serenity

═══════════════════════════════════════════
STEP 2 — LAYERED DECOMPOSITION
═══════════════════════════════════════════
Decompose the scene into exactly 3–4 SVG layers rendered as grouped <g> elements:

Layer 1 — FOUNDATION
  A full-bleed background using gradients or solid fills. Establishes mood and color ground.

Layer 2 — CORE ELEMENTS
  The primary subjects of the image, simplified into clean geometric or organic vector paths.
  Use <path>, <circle>, <polygon>, <ellipse>. Do NOT use <image> or external references.

Layer 3 — DETAIL / AURA
  Fine lines, glows, halos, or filigree that add depth. Use <filter> with feGaussianBlur for
  glow effects. Use thin stroked paths for ethereal line work.

Layer 4 — KINETIC OVERLAY (optional)
  Floating particles, orbiting rings, or drifting shapes that reinforce the animation layer.

═══════════════════════════════════════════
STEP 3 — KINETIC LOGIC (CSS @keyframes ONLY)
═══════════════════════════════════════════
Define all animations inside a <style> block within the SVG. No JavaScript. Use these
three animation archetypes, composing them together:

• NESHAMA (Breath) — Gentle pulse of life:
  @keyframes neshama { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.04); opacity: 1; } }
  animation: neshama 4s ease-in-out infinite;

• SOVEV (Orbit) — Slow celestial rotation:
  @keyframes sovev { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  animation: sovev 20s linear infinite;
  Apply with transform-origin set to the SVG center.

• FLOW (Eternal Drawing) — Lines that draw themselves forever:
  @keyframes flow { 0% { stroke-dashoffset: 1000; } 100% { stroke-dashoffset: 0; } }
  Use stroke-dasharray="1000" stroke-dashoffset="1000" on path elements.
  animation: flow 6s ease-in-out infinite alternate;

Stagger animation delays across elements using animation-delay for a living, breathing feel.

═══════════════════════════════════════════
STEP 4 — TECHNICAL CONSTRAINTS
═══════════════════════════════════════════
• viewBox="0 0 800 600" — always responsive, never use fixed width/height on the root SVG
• xmlns="http://www.w3.org/2000/svg" on the root element
• All colors, gradients, and filters defined in <defs>
• Brief inline comments (<!-- Layer: Foundation -->) marking each layer group
• Zero external resources — fully self-contained
• Prioritize visual IMPACT. Bold choices beat safe mediocrity.

═══════════════════════════════════════════
OUTPUT RULE — ABSOLUTE
═══════════════════════════════════════════
Reply with ONLY the raw SVG code.
Begin your response with <svg and end with </svg>.
No markdown. No code fences. No explanation. No preamble.`

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

    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 8192,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and produce the animated SVG masterpiece according to your four-step process.',
            },
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
