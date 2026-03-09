const https = require('https')

/**
 * Jina Reader — AI-optimized content extraction.
 * Prepend r.jina.ai/ to any URL for clean markdown output.
 * Free tier available, no API key required for basic use.
 */
async function jinaExtract(url, config = {}) {
  const apiKey = config.apiKey || process.env.JINA_API_KEY
  const readerUrl = `https://r.jina.ai/${url}`

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Spectrawl/0.1.0'
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const data = await fetchJson(readerUrl, headers)

  return {
    content: data.data?.content || data.content || '',
    title: data.data?.title || data.title || '',
    url: data.data?.url || url,
    description: data.data?.description || ''
  }
}

/**
 * Jina Search — search + extract in one call.
 * Prepend s.jina.ai/ to a query for search results.
 */
async function jinaSearch(query, config = {}) {
  const apiKey = config.apiKey || process.env.JINA_API_KEY
  const searchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`
  const maxResults = config.maxResults || 5

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Spectrawl/0.1.0'
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const data = await fetchJson(searchUrl, headers)

  const results = (data.data || []).slice(0, maxResults)
  return results.map(r => ({
    url: r.url,
    title: r.title || '',
    snippet: r.description || '',
    fullContent: r.content || '',
    engine: 'jina'
  }))
}

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { 
          // Jina sometimes returns plain text/markdown
          resolve({ content: data, title: '', url }) 
        }
      })
    }).on('error', reject)
  })
}

module.exports = { jinaExtract, jinaSearch }
