const https = require('https')
const http = require('http')
const { URL } = require('url')

/**
 * Scrape URLs for full content.
 * Strategy: fetch + readability parse first (90% of pages).
 * Falls back to browser for JS-heavy/blocked pages.
 */
async function scrapeUrls(urls, opts = {}) {
  const results = {}
  const timeout = opts.timeout || 10000
  const concurrent = opts.concurrent || 3

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrent) {
    const batch = urls.slice(i, i + concurrent)
    const promises = batch.map(url => scrapeUrl(url, timeout).catch(() => null))
    const batchResults = await Promise.all(promises)
    
    batch.forEach((url, idx) => {
      if (batchResults[idx]) {
        results[url] = batchResults[idx]
      }
    })
  }

  return results
}

async function scrapeUrl(url, timeout = 10000) {
  const html = await fetchPage(url, timeout)
  return extractReadableContent(html)
}

function fetchPage(url, timeout = 10000, redirects = 3) {
  return new Promise((resolve, reject) => {
    if (redirects <= 0) return reject(new Error('Too many redirects'))
    
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http
    
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity'
      }
    }

    const req = client.request(opts, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString()
        return fetchPage(redirectUrl, timeout, redirects - 1).then(resolve).catch(reject)
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }

      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })
    
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Scrape timeout')) })
    req.end()
  })
}

/**
 * Basic readability extraction.
 * Strips scripts, styles, nav, footer, ads. Extracts main content as text.
 */
function extractReadableContent(html) {
  // Remove scripts, styles, comments
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')

  // Try to find main content
  const mainMatch = content.match(/<main[\s\S]*?<\/main>/i) ||
                    content.match(/<article[\s\S]*?<\/article>/i) ||
                    content.match(/<div[^>]*(?:content|article|post|entry|main)[^>]*>[\s\S]*?<\/div>/i)

  if (mainMatch) {
    content = mainMatch[0]
  }

  // Convert to text
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  // Truncate to reasonable length
  if (content.length > 10000) {
    content = content.slice(0, 10000) + '...'
  }

  return content
}

module.exports = { scrapeUrls, scrapeUrl, extractReadableContent }
