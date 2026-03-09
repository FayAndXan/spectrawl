const https = require('https')

/**
 * AI result reranker — scores search results by relevance.
 * Uses Gemini Flash by default (free, fast).
 * This is Tavily's secret sauce: AI-scored relevance, not raw search order.
 */
class Reranker {
  constructor(config = {}) {
    this.provider = config.provider || 'gemini'
    this.model = config.model || 'gemini-2.0-flash'
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY
  }

  /**
   * Rerank results by relevance to query.
   * Returns results sorted by score (highest first) with score field added.
   */
  async rerank(query, results) {
    if (!this.apiKey || results.length <= 1) return results

    const batch = results.slice(0, 20) // Max 20 results to rerank
    
    const prompt = `Score each search result's relevance to the query on a scale of 0.0 to 1.0.

Query: "${query}"

Results:
${batch.map((r, i) => `[${i}] ${r.title}\n${(r.snippet || r.content || '').slice(0, 200)}`).join('\n\n')}

Respond with ONLY a JSON array of scores, one per result. Example: [0.95, 0.72, 0.31]
No explanation, just the array.`

    try {
      const text = await this._call(prompt)
      const scores = JSON.parse(text.match(/\[[\d.,\s]+\]/)?.[0] || '[]')
      
      if (scores.length !== batch.length) return results

      // Attach scores and sort
      const scored = batch.map((r, i) => ({ ...r, score: scores[i] || 0 }))
      scored.sort((a, b) => b.score - a.score)
      
      // Append any results beyond the batch limit
      if (results.length > 20) {
        scored.push(...results.slice(20).map(r => ({ ...r, score: 0 })))
      }
      
      return scored
    } catch (err) {
      console.warn('Reranking failed, using original order:', err.message)
      return results
    }
  }

  async _call(prompt) {
    if (this.provider === 'gemini') {
      const model = this.model || 'gemini-2.0-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`
      const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 200 }
      })
      const data = await postJson(url, body)
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    }

    // Fallback: OpenAI-compatible
    const url = this.provider === 'minimax' 
      ? 'https://api.minimax.chat/v1/text/chatcompletion_v2'
      : 'https://api.openai.com/v1/chat/completions'
    
    const body = JSON.stringify({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0
    })
    const data = await postJson(url, body, {
      'Authorization': `Bearer ${this.apiKey}`
    })
    return data.choices?.[0]?.message?.content || '[]'
  }
}

function postJson(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Reranker timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { Reranker }
