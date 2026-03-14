const https = require('https')

/**
 * Gemini Grounded Search — uses Google's Gemini API with built-in Google Search.
 * Free tier: 1,500 req/day for Flash.
 * Returns both an AI answer AND the search results it found.
 * 
 * This is basically free Google search + AI summarization in one call.
 */
async function geminiGroundedSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY required for grounded search')

  const model = config.model || process.env.GEMINI_GROUNDED_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const body = JSON.stringify({
    contents: [{
      parts: [{ text: `Search the web and provide relevant results for: ${query}` }]
    }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000
    }
  })

  const data = await post(url, body)

  if (data.error) {
    throw new Error(`Gemini grounded search: ${data.error.message}`)
  }

  // Extract grounding metadata (search results)
  const candidate = data.candidates?.[0]
  const grounding = candidate?.groundingMetadata
  const chunks = grounding?.groundingChunks || []
  const answer = candidate?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || ''

  // Resolve redirect URLs to actual URLs (parallel, with timeout)
  const rawResults = chunks.map((chunk, i) => ({
    title: chunk.web?.title || `Result ${i + 1}`,
    redirectUrl: chunk.web?.uri || '',
    snippet: '',
    source: 'gemini-grounded'
  })).filter(r => r.redirectUrl)

  // Follow redirects to get real URLs
  const resolved = await Promise.all(
    rawResults.map(r => resolveRedirect(r.redirectUrl).catch(() => r.redirectUrl))
  )

  const results = rawResults.map((r, i) => ({
    ...r,
    url: resolved[i] || r.redirectUrl
  }))

  // Add confidence scores from grounding supports
  const supports = grounding?.groundingSupports || []
  for (const support of supports) {
    const indices = support.groundingChunkIndices || []
    const scores = support.confidenceScores || []
    indices.forEach((idx, j) => {
      if (results[idx] && scores[j]) {
        results[idx].confidence = Math.max(results[idx].confidence || 0, scores[j])
      }
    })
  }

  // Attach the AI answer as metadata
  if (results.length > 0) {
    results._groundedAnswer = answer
  }

  return results
}

/**
 * Follow a redirect URL to get the actual destination.
 */
function resolveRedirect(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : require('http')
    const req = client.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'HEAD',
      headers: { 'User-Agent': 'Spectrawl/0.3' }
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        resolve(res.headers.location)
      } else {
        resolve(url)
      }
    })
    req.on('error', () => resolve(url))
    req.setTimeout(3000, () => { req.destroy(); resolve(url) })
    req.end()
  })
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Gemini response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Gemini grounded search timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { geminiGroundedSearch }
