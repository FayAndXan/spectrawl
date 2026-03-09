const http = require('http')
const https = require('https')

/**
 * SearXNG — self-hosted metasearch engine.
 * Aggregates 70+ search engines (Google, Bing, DDG, etc.)
 * Free, unlimited, no API key needed.
 * 
 * Requires a SearXNG instance running (self-hosted or public).
 * Default: http://localhost:8888 (local Docker instance)
 * 
 * Docker quick start:
 *   docker run -d -p 8888:8080 searxng/searxng
 */
async function searxngSearch(query, config = {}) {
  const baseUrl = config.url || process.env.SEARXNG_URL || 'http://localhost:8888'
  const maxResults = config.maxResults || 10
  const engines = config.engines || '' // empty = all engines
  const categories = config.categories || 'general'

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories,
    pageno: '1'
  })
  
  if (engines) params.set('engines', engines)

  const url = `${baseUrl}/search?${params}`
  const data = await fetchJson(url)

  if (!data.results) return []

  return data.results.slice(0, maxResults).map(r => ({
    url: r.url,
    title: r.title || '',
    snippet: r.content || '',
    engine: r.engine || 'searxng',
    engines: r.engines || [],
    score: r.score || 0
  }))
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http

    client.get({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Spectrawl/0.1.0'
      }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`SearXNG returned invalid JSON: ${data.slice(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

module.exports = { searxngSearch }
