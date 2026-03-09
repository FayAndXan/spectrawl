const https = require('https')

/**
 * Brave Search API — 2000 queries/month free tier.
 * Requires BRAVE_API_KEY in config or env.
 */
async function braveSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.BRAVE_API_KEY
  if (!apiKey) throw new Error('Brave API key not configured')

  const maxResults = config.maxResults || 10
  const params = new URLSearchParams({
    q: query,
    count: String(maxResults)
  })

  const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    'X-Subscription-Token': apiKey,
    'Accept': 'application/json'
  })

  if (!data.web?.results) return []

  return data.web.results.map(r => ({
    url: r.url,
    title: r.title,
    snippet: r.description || '',
    engine: 'brave'
  }))
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': 'Spectrawl/0.1.0'
      }
    }

    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Brave API returned invalid JSON: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Brave API timeout')) })
    req.end()
  })
}

module.exports = { braveSearch }
