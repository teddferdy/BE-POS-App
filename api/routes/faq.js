const { Router } = require('express')
const faq = require('../../data/faq.json')
const { validate } = require('../middleware/validate')
const { askFaqSchema } = require('../validation/schemas')

const router = Router()
const GEMINI_KEY = process.env.GEMINI_API_KEY

// ponytail: linear scan, upgrade ke inverted index kalo FAQ > 500 item
function search(query) {
  const q = query.toLowerCase()
  return faq
    .filter(
      (item) =>
        item.keywords.some((k) => k.includes(q)) ||
        item.q.toLowerCase().includes(q)
    )
    .map(({ q, a }) => ({ q, a }))
}

router.get('/faq', (req, res) => {
  const { q } = req.query
  if (!q) return res.json(faq.map(({ q, a }) => ({ q, a })))
  res.json(search(q))
})

router.post('/faq/ask', validate(askFaqSchema), async (req, res) => {
  const { question } = req.body
  if (!question) return res.status(400).json({ error: 'question required' })
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Kamu asisten analisa toko. Jawab berdasarkan data ini:\n${JSON.stringify(req.body.data || {})}\n\nPertanyaan: ${question}`
                }
              ]
            }
          ]
        })
      }
    )
    const json = await resp.json()
    if (json.error) {
      console.log('[Gemini] error:', json.error.message)
      return res.json({ answer: '', error: json.error.message })
    }
    res.json({ answer: json.candidates?.[0]?.content?.parts?.[0]?.text || '' })
  } catch (err) {
    console.log('[Gemini] fetch error:', err.message)
    res.json({ answer: '', error: err.message })
  }
})

module.exports = router
