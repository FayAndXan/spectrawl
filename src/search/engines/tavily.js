const https = require('https')

/**
 * Tavily Search API — high-quality search with optional AI answers.
 * Free tier: 1,000 queries/month.
 * Use as fallback after Gemini Grounded's 5K/month free tier.
 */
async function tavilySearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.TAVILY_API_KEY
  if (!apiKey) throw new Error('TAVILY_API_KEY required for Tavily search')

  const body = JSON.stringify({
    query,
    search_depth: config.searchDepth || 'basic',
    include_answer: config.includeAnswer || false,
    include_raw_content: false,
    max_results: config.maxResults || 10,
    ...(config.topic && { topic: config.topic }),
    ...(config.days && { days: config.days })
  })

  const data = await post('https://api.tavily.com/search', body, apiKey)

  if (!data.results) {
    throw new Error(`Tavily search failed: ${JSON.stringify(data).slice(0, 200)}`)
  }

  const results = data.results.map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    score: r.score || 0,
    source: 'tavily'
  }))

  // Attach Tavily's answer if requested
  if (data.answer && results.length > 0) {
    results._tavilyAnswer = data.answer
  }

  return results
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
        'Authorization': `Bearer ${apiKey}`
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Tavily response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Tavily search timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { tavilySearch }
