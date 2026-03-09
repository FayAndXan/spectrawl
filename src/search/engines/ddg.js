const https = require('https')
const { URL } = require('url')

/**
 * DuckDuckGo search — free, unlimited, no API key needed.
 * Uses the JSON API endpoint (api.duckduckgo.com).
 * Note: DDG Lite blocks datacenter IPs with CAPTCHAs.
 * The JSON API is more permissive but returns instant answers, not full web results.
 * For full results, we use the HTML endpoint with retries.
 */
async function ddgSearch(query, config = {}) {
  const maxResults = config.maxResults || 10
  
  // Strategy 1: Try the JSON API (instant answers)
  try {
    const results = await ddgJsonApi(query, maxResults)
    if (results.length > 0) return results
  } catch (e) {
    // Fall through
  }

  // Strategy 2: Try HTML search via different endpoint
  try {
    const results = await ddgHtmlSearch(query, maxResults)
    if (results.length > 0) return results
  } catch (e) {
    // Fall through
  }

  return []
}

async function ddgJsonApi(query, maxResults) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
  const data = await fetchJson(url)
  
  const results = []

  // Abstract (top result)
  if (data.AbstractURL && data.Abstract) {
    results.push({
      url: data.AbstractURL,
      title: data.Heading || query,
      snippet: data.Abstract,
      engine: 'ddg'
    })
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= maxResults) break
      if (topic.FirstURL && topic.Text) {
        results.push({
          url: topic.FirstURL,
          title: topic.Text.slice(0, 100),
          snippet: topic.Text,
          engine: 'ddg'
        })
      }
      // Subtopics
      if (topic.Topics) {
        for (const sub of topic.Topics) {
          if (results.length >= maxResults) break
          if (sub.FirstURL && sub.Text) {
            results.push({
              url: sub.FirstURL,
              title: sub.Text.slice(0, 100),
              snippet: sub.Text,
              engine: 'ddg'
            })
          }
        }
      }
    }
  }

  // Results section
  if (data.Results) {
    for (const r of data.Results) {
      if (results.length >= maxResults) break
      if (r.FirstURL && r.Text) {
        results.push({
          url: r.FirstURL,
          title: r.Text.slice(0, 100),
          snippet: r.Text,
          engine: 'ddg'
        })
      }
    }
  }

  return results
}

async function ddgHtmlSearch(query, maxResults) {
  // Use the HTML endpoint with a more browser-like request
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const html = await fetchHtml(url)
  
  const results = []
  
  // DDG HTML results use class "result__a" for links and "result__snippet" for snippets
  const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

  const links = []
  let match
  while ((match = resultRegex.exec(html)) !== null) {
    links.push({ url: decodeUddg(match[1]), title: stripHtml(match[2]) })
  }

  const snippets = []
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]))
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      url: links[i].url,
      title: links[i].title,
      snippet: snippets[i] || '',
      engine: 'ddg'
    })
  }

  return results
}

function decodeUddg(url) {
  // DDG wraps URLs in //duckduckgo.com/l/?uddg=<encoded_url>
  if (url.includes('uddg=')) {
    const match = url.match(/uddg=([^&]+)/)
    if (match) return decodeURIComponent(match[1])
  }
  return url
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
        catch (e) { reject(new Error('Invalid JSON from DDG API')) }
      })
    }).on('error', reject)
  })
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = { ddgSearch }
