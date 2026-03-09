const https = require('https')

/**
 * Serper.dev — 2500 free Google SERP queries.
 * Requires SERPER_API_KEY in config or env.
 */
async function serperSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.SERPER_API_KEY
  if (!apiKey) throw new Error('Serper API key not configured')

  const maxResults = config.maxResults || 10
  const body = JSON.stringify({
    q: query,
    num: maxResults
  })

  const data = await postJson('https://google.serper.dev/search', body, {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  })

  if (!data.organic) return []

  return data.organic.map(r => ({
    url: r.link,
    title: r.title,
    snippet: r.snippet || '',
    engine: 'serper'
  }))
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'User-Agent': 'Spectrawl/0.1.0',
        'Content-Length': Buffer.byteLength(body)
      }
    }

    const req = https.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error(`Serper API returned invalid JSON: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Serper API timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { serperSearch }
