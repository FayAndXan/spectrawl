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

  const model = config.model || 'gemini-2.0-flash'
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

  // Convert grounding chunks to standard search result format
  const results = chunks.map((chunk, i) => ({
    title: chunk.web?.title || `Result ${i + 1}`,
    url: chunk.web?.uri || '',
    snippet: '', // Gemini doesn't give per-result snippets
    source: 'gemini-grounded'
  })).filter(r => r.url)

  // Also try to extract URLs from grounding support
  const supports = grounding?.groundingSupports || []
  for (const support of supports) {
    const indices = support.groundingChunkIndices || []
    // Already captured above
  }

  // Attach the AI answer as metadata
  if (results.length > 0) {
    results._groundedAnswer = answer
  }

  return results
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
