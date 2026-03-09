const https = require('https')
const http = require('http')
const { URL } = require('url')
const { jinaExtract } = require('./engines/jina')

/**
 * Scrape URLs for full content.
 * Dual engine approach (like tavily-open):
 *   1. Jina Reader (fast, AI-optimized markdown) — if available
 *   2. Readability (built-in, no deps) — fallback
 *   3. Browser (Camoufox/Playwright) — for JS-heavy/blocked pages
 */
async function scrapeUrls(urls, opts = {}) {
  const results = {}
  const timeout = opts.timeout || 10000
  const concurrent = opts.concurrent || 3
  const engine = opts.engine || 'auto' // 'jina', 'readability', 'auto'

  // All URLs in parallel (with per-URL timeout)
  const promises = urls.map(url => {
    const p = scrapeUrl(url, { timeout, engine }).catch(() => null)
    // Hard timeout per URL
    const timer = new Promise(resolve => setTimeout(() => resolve(null), timeout + 1000))
    return Promise.race([p, timer])
  })
  const allResults = await Promise.all(promises)
  
  urls.forEach((url, idx) => {
    if (allResults[idx]) {
      results[url] = allResults[idx]
    }
  })

  return results
}

async function scrapeUrl(url, opts = {}) {
  const { timeout = 10000, engine = 'auto', browse } = opts

  // Try Jina first if available (better markdown output)
  if (engine === 'jina' || engine === 'auto') {
    try {
      const result = await jinaExtract(url)
      if (result.content && result.content.length > 200) {
        return result.content
      }
    } catch (e) {
      // Fall through to readability
    }
  }

  // Readability fallback (HTTP fetch + HTML→markdown)
  try {
    const html = await fetchPage(url, timeout)
    const content = extractMarkdown(html)
    if (content && content.length > 200) {
      return content
    }
  } catch (e) {
    // Fall through to browser
  }

  // Browser fallback for JS-rendered pages or when extraction is too short
  // This is where we beat Tavily — they can't render JS pages
  if (browse !== false) {
    try {
      const { BrowseEngine } = require('../browse')
      const browser = new BrowseEngine()
      const result = await browser.browse(url, { 
        timeout, 
        extractText: true,
        screenshot: false 
      })
      await browser.close()
      if (result.text && result.text.length > 200) {
        return result.text
      }
    } catch (e) {
      // All methods exhausted
    }
  }

  // Return whatever we got, even if short
  try {
    const html = await fetchPage(url, timeout)
    return extractMarkdown(html)
  } catch (e) {
    return ''
  }
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
 * Extract content as clean markdown (improved over basic readability).
 * Handles: headings, lists, code blocks, tables, links, bold/italic.
 */
function extractMarkdown(html) {
  // Remove noise
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')

  // Try to find main content
  const mainMatch = content.match(/<main[\s\S]*?<\/main>/i) ||
                    content.match(/<article[\s\S]*?<\/article>/i) ||
                    content.match(/<div[^>]*(?:content|article|post|entry|main)[^>]*>[\s\S]*?<\/div>/i)

  if (mainMatch) content = mainMatch[0]

  // Convert to markdown
  content = content
    // Headings
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
    // Bold/italic
    .replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Code blocks
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`')
    // Lists
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?[ou]l[^>]*>/gi, '\n')
    // Table (basic)
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '|$1|\n')
    .replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, ' $1 |')
    // Paragraphs/breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    // Clean whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ +/gm, '')
    .trim()

  // Truncate
  if (content.length > 15000) {
    content = content.slice(0, 15000) + '\n\n...(truncated)'
  }

  return content
}

module.exports = { scrapeUrls, scrapeUrl, extractMarkdown }
