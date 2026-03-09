const https = require('https')

/**
 * Query expansion — generates variant queries to catch what one search misses.
 * "best CRM" → ["top CRM software 2026", "CRM comparison startups", "best CRM for small business"]
 * Merges and deduplicates results across all variants.
 */
class QueryExpander {
  constructor(config = {}) {
    this.provider = config.provider || 'gemini'
    this.model = config.model || 'gemini-2.0-flash'
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY
    this.variants = config.variants || 3
  }

  /**
   * Expand a query into multiple search variants.
   * Returns array of query strings (including the original).
   */
  async expand(query) {
    if (!this.apiKey) return [query]

    const prompt = `Generate ${this.variants} alternative search queries for: "${query}"

Requirements:
- Each should find different but relevant results
- Include synonyms, related terms, different phrasings
- One should be more specific, one broader, one from a different angle

Respond with ONLY a JSON array of strings. No explanation.
Example: ["alternative query 1", "alternative query 2", "alternative query 3"]`

    try {
      const text = await this._call(prompt)
      const match = text.match(/\[[\s\S]*?\]/)
      if (!match) return [query]
      
      const variants = JSON.parse(match[0])
      if (!Array.isArray(variants)) return [query]
      
      return [query, ...variants.slice(0, this.variants)]
    } catch (err) {
      console.warn('Query expansion failed:', err.message)
      return [query]
    }
  }

  /**
   * Merge and deduplicate results from multiple queries.
   * Keeps highest-scored version of each URL.
   */
  mergeResults(resultSets) {
    const seen = new Map() // url → result

    for (const results of resultSets) {
      for (const r of results) {
        const url = r.url?.toLowerCase()
        if (!url) continue
        
        const existing = seen.get(url)
        if (!existing || (r.score || 0) > (existing.score || 0)) {
          seen.set(url, r)
        }
      }
    }

    return Array.from(seen.values())
  }

  async _call(prompt) {
    if (this.provider === 'gemini') {
      const model = this.model || 'gemini-2.0-flash'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`
      const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
      })
      const data = await postJson(url, body)
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    }

    const url = 'https://api.openai.com/v1/chat/completions'
    const body = JSON.stringify({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    })
    const data = await postJson(url, body, { 'Authorization': `Bearer ${this.apiKey}` })
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
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Expander timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { QueryExpander }
