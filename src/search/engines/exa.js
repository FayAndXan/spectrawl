const https = require('https')

/**
 * Exa Search API — AI-native search with neural understanding and content retrieval.
 * Returns clean, agent-ready results with highlights, full text, and summaries.
 * Get an API key at https://dashboard.exa.ai.
 */
async function exaSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.EXA_API_KEY
  if (!apiKey) throw new Error('EXA_API_KEY required for Exa search')

  const maxResults = config.maxResults || 10

  const contents = buildContents(config)

  const payload = {
    query,
    type: config.type || 'auto',
    numResults: maxResults,
    ...(contents && { contents }),
    ...(config.category && { category: config.category }),
    ...(config.includeDomains && { includeDomains: config.includeDomains }),
    ...(config.excludeDomains && { excludeDomains: config.excludeDomains }),
    ...(config.startPublishedDate && { startPublishedDate: config.startPublishedDate }),
    ...(config.endPublishedDate && { endPublishedDate: config.endPublishedDate }),
    ...(config.startCrawlDate && { startCrawlDate: config.startCrawlDate }),
    ...(config.endCrawlDate && { endCrawlDate: config.endCrawlDate }),
    ...(config.userLocation && { userLocation: config.userLocation })
  }

  const data = await post('https://api.exa.ai/search', JSON.stringify(payload), apiKey)

  if (!Array.isArray(data.results)) {
    throw new Error(`Exa search failed: ${JSON.stringify(data).slice(0, 200)}`)
  }

  return data.results.map(r => ({
    url: r.url,
    title: r.title || '',
    snippet: extractSnippet(r),
    engine: 'exa'
  }))
}

function buildContents(config) {
  if (config.contents === false) return null
  if (config.contents && typeof config.contents === 'object') return config.contents

  // Default: highlights + a capped text window — matches the "agent-ready" shape
  // used by the rest of the cascade (snippet-sized content, not full pages).
  return {
    highlights: true,
    text: { maxCharacters: 1000 }
  }
}

function extractSnippet(result) {
  if (Array.isArray(result.highlights) && result.highlights.length > 0) {
    return result.highlights.join(' ')
  }
  if (typeof result.summary === 'string' && result.summary) {
    return result.summary
  }
  if (typeof result.text === 'string' && result.text) {
    return result.text.slice(0, 500)
  }
  return ''
}

function post(url, body, apiKey) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': apiKey,
        'x-exa-integration': 'spectrawl'
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Exa response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Exa search timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { exaSearch }
