const https = require('https')

/**
 * Google Custom Search Engine — 100 queries/day free.
 * Requires GOOGLE_CSE_KEY and GOOGLE_CSE_ID in config or env.
 */
async function googleCseSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.GOOGLE_CSE_KEY
  const cseId = config.cseId || process.env.GOOGLE_CSE_ID
  if (!apiKey || !cseId) throw new Error('Google CSE key/ID not configured')

  const maxResults = Math.min(config.maxResults || 10, 10) // Google caps at 10
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(maxResults)
  })

  const data = await fetchJson(`https://www.googleapis.com/customsearch/v1?${params}`)

  if (!data.items) return []

  return data.items.map(r => ({
    url: r.link,
    title: r.title,
    snippet: r.snippet || '',
    engine: 'google-cse'
  }))
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'Spectrawl/0.1.0' }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON from Google CSE')) }
      })
    }).on('error', reject)
  })
}

module.exports = { googleCseSearch }
