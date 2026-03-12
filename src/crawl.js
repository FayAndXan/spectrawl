/**
 * Spectrawl Crawl Engine v2
 * Multi-page website crawler using our own browse engine (Camoufox).
 * No external dependencies (no Jina, no Cloudflare).
 * Supports sync + async (job-based) modes.
 * Auto-detects system RAM and parallelizes crawling accordingly.
 */

const crypto = require('crypto')
const os = require('os')

// ~250MB per browser tab (Camoufox average)
const MB_PER_TAB = 250
// Reserve this much RAM for OS + other processes
const RESERVED_MB = 1500

const DEFAULT_OPTS = {
  depth: 2,
  maxPages: 50,
  format: 'markdown',
  delay: 300,            // ms between batch launches
  stealth: true,
  scope: 'domain',
  timeout: 30000,
  concurrency: 'auto',   // 'auto' | number — auto-detect from RAM
  includeLinks: true,
  includePatterns: [],
  excludePatterns: [],
  merge: false,
  skipPatterns: [
    /\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|zip|gz|tar|mp4|mp3|woff|woff2|ttf|css|js)(\?|$)/i,
    /\/_next\//,
    /\/static\//,
    /\/assets\//,
    /mintcdn\.com/,
    /#/,
    /^mailto:/,
    /^tel:/,
    /^javascript:/,
  ]
}

// In-memory job store for async crawls
const jobs = new Map()

/**
 * Calculate max safe concurrency based on available system RAM.
 */
function detectConcurrency() {
  const totalMB = Math.floor(os.totalmem() / 1024 / 1024)
  const freeMB = Math.floor(os.freemem() / 1024 / 1024)
  // Use the lower of: (free RAM) or (total - reserved)
  const availableMB = Math.min(freeMB, totalMB - RESERVED_MB)
  const maxTabs = Math.max(1, Math.floor(availableMB / MB_PER_TAB))
  // Cap at 10 — diminishing returns and politeness
  const concurrency = Math.min(maxTabs, 10)
  console.log(`[crawl] RAM: ${totalMB}MB total, ${freeMB}MB free → ${concurrency} concurrent tabs`)
  return concurrency
}

class CrawlEngine {
  constructor(browseEngine, cache) {
    this.browseEngine = browseEngine
    this.cache = cache
  }

  /**
   * Crawl a website starting from a URL.
   * Automatically parallelizes based on available RAM.
   */
  async crawl(startUrl, opts = {}, cookies = null) {
    const cleanOpts = Object.fromEntries(
      Object.entries(opts).filter(([_, v]) => v !== undefined)
    )
    const config = { ...DEFAULT_OPTS, ...cleanOpts }
    const startTime = Date.now()

    // Determine concurrency
    const concurrency = config.concurrency === 'auto'
      ? detectConcurrency()
      : Math.max(1, Math.min(config.concurrency, 10))

    const startParsed = new URL(startUrl)
    const baseDomain = startParsed.hostname
    const basePrefix = startUrl.replace(/\/$/, '')

    const visited = new Set()
    const queue = [{ url: startUrl, depth: 0 }]
    const pages = []
    const failed = []
    let activeCount = 0

    // Process queue with concurrency control
    const processUrl = async (item) => {
      const { url, depth } = item
      try {
        const page = await this._fetchPage(url, config, cookies)
        if (!page) { failed.push({ url, error: 'empty' }); return }

        const links = page.links || []
        pages.push({
          url,
          title: page.title || '',
          content: page.content || '',
          links: config.includeLinks ? links : undefined,
          depth
        })

        // Enqueue child links
        if (depth < config.depth) {
          for (const link of links) {
            const absLink = resolveUrl(link, url)
            if (!absLink) continue
            const normLink = normalizeUrl(absLink)
            if (visited.has(normLink)) continue
            // Pre-filter before queueing
            if (!this._inScope(absLink, baseDomain, basePrefix, config.scope)) continue
            if (config.skipPatterns.some(p => p.test(absLink))) continue
            if (!this._matchesFilters(absLink, config.includePatterns, config.excludePatterns)) continue
            visited.add(normLink)
            queue.push({ url: absLink, depth: depth + 1 })
          }
        }
      } catch (e) {
        failed.push({ url, error: e.message })
      }
    }

    // Seed the first URL
    visited.add(normalizeUrl(startUrl))

    // BFS with parallel workers
    while (queue.length > 0 || activeCount > 0) {
      // Launch up to `concurrency` parallel fetches
      const batch = []
      while (queue.length > 0 && batch.length < concurrency && (pages.length + activeCount + batch.length) < config.maxPages) {
        batch.push(queue.shift())
      }

      if (batch.length === 0 && activeCount === 0) break

      if (batch.length > 0) {
        activeCount += batch.length
        const results = await Promise.allSettled(
          batch.map(item => processUrl(item))
        )
        activeCount -= batch.length

        // Small delay between batches to be polite
        if (queue.length > 0 && config.delay > 0) {
          await sleep(config.delay)
        }
      }

      // Stop if we've hit maxPages
      if (pages.length >= config.maxPages) break
    }

    const duration = Date.now() - startTime
    const result = {
      startUrl,
      pages,
      stats: {
        total: visited.size,
        crawled: pages.length,
        failed: failed.length,
        concurrency,
        duration,
        pagesPerSecond: pages.length > 0 ? +(pages.length / (duration / 1000)).toFixed(2) : 0
      },
      failed: failed.length > 0 ? failed : undefined
    }

    if (config.merge) {
      result.merged = pages.map(p => {
        return `<!-- Source: ${p.url} -->\n# ${p.title || p.url}\n\n${p.content}`
      }).join('\n\n---\n\n')
    }

    return result
  }

  /**
   * Start an async crawl job. Returns job ID immediately.
   */
  startJob(startUrl, opts = {}, cookies = null) {
    const jobId = crypto.randomUUID()
    const job = {
      id: jobId,
      startUrl,
      status: 'running',
      started: Date.now(),
      finished: 0,
      total: 0,
      pages: [],
      failed: [],
      error: null
    }
    jobs.set(jobId, job)

    this.crawl(startUrl, opts, cookies)
      .then(result => {
        job.status = 'completed'
        job.pages = result.pages
        job.failed = result.failed || []
        job.finished = result.stats.crawled
        job.total = result.stats.total
        job.duration = result.stats.duration
        job.concurrency = result.stats.concurrency
        job.pagesPerSecond = result.stats.pagesPerSecond
      })
      .catch(err => {
        job.status = 'errored'
        job.error = err.message
      })

    return { jobId, status: 'running' }
  }

  /**
   * Get job status/results.
   */
  getJob(jobId) {
    const job = jobs.get(jobId)
    if (!job) return null
    return {
      id: job.id,
      startUrl: job.startUrl,
      status: job.status,
      started: job.started,
      finished: job.finished,
      total: job.total,
      pageCount: job.pages.length,
      concurrency: job.concurrency,
      pagesPerSecond: job.pagesPerSecond,
      error: job.error,
      pages: job.status === 'completed' ? job.pages : undefined,
      failed: job.status === 'completed' ? (job.failed.length > 0 ? job.failed : undefined) : undefined,
      duration: job.duration
    }
  }

  /**
   * List all jobs.
   */
  listJobs() {
    return Array.from(jobs.values()).map(j => ({
      id: j.id,
      startUrl: j.startUrl,
      status: j.status,
      pageCount: j.pages.length,
      started: j.started
    }))
  }

  /**
   * Get system info for crawl capacity estimation.
   */
  static getCapacity() {
    const totalMB = Math.floor(os.totalmem() / 1024 / 1024)
    const freeMB = Math.floor(os.freemem() / 1024 / 1024)
    const concurrency = detectConcurrency()
    // Realistic: ~0.8s per page with fast mode, limited by shared browser pipeline
    // Concurrency helps but not linearly — shared browser bottleneck
    const effectiveConcurrency = Math.min(concurrency, 5) // diminishing returns past 5
    const pagesPerMinute = Math.floor(effectiveConcurrency * 30)  // ~2s effective per page with overhead
    return {
      totalRamMB: totalMB,
      freeRamMB: freeMB,
      maxConcurrency: concurrency,
      estimatedPagesPerMinute: pagesPerMinute,
      estimate100pages: `~${Math.ceil(100 / pagesPerMinute)} min`,
      estimate1000pages: `~${Math.ceil(1000 / pagesPerMinute)} min`
    }
  }

  async _fetchPage(url, config, cookies) {
    try {
      const result = await this.browseEngine.browse(url, {
        stealth: config.stealth,
        _cookies: cookies,
        timeout: config.timeout,
        html: true,
        noCache: true,
        fastMode: true  // crawl mode: reduced delays for speed
      })
      if (result?.content) {
        const linkSource = result.html || result.content
        return {
          title: result.title || '',
          content: result.content,
          links: extractLinks(linkSource, url)
        }
      }
    } catch (e) {
      throw new Error(`Failed to fetch ${url}: ${e.message}`)
    }
    return null
  }

  _inScope(url, baseDomain, basePrefix, scope) {
    try {
      const parsed = new URL(url)
      if (scope === 'domain') return parsed.hostname === baseDomain || parsed.hostname.endsWith('.' + baseDomain)
      if (scope === 'prefix') return url.startsWith(basePrefix)
      return true
    } catch {
      return false
    }
  }

  _matchesFilters(url, includePatterns, excludePatterns) {
    if (excludePatterns && excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (wildcardMatch(url, pattern)) return false
      }
    }
    if (includePatterns && includePatterns.length > 0) {
      return includePatterns.some(pattern => wildcardMatch(url, pattern))
    }
    return true
  }
}

function wildcardMatch(str, pattern) {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*')
  return new RegExp('^' + regex + '$').test(str)
}

function extractLinks(content, baseUrl) {
  const links = []
  const hrefMatches = content.matchAll(/href=["']([^"']+)["']/gi)
  for (const m of hrefMatches) {
    const resolved = resolveUrl(m[1], baseUrl)
    if (resolved && !links.includes(resolved)) links.push(resolved)
  }
  const mdMatches = content.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g)
  for (const m of mdMatches) {
    if (!links.includes(m[2])) links.push(m[2])
  }
  return links
}

function resolveUrl(url, base) {
  try {
    if (url.startsWith('http')) return url
    return new URL(url, base).href
  } catch {
    return null
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    let href = u.href
    if (href.endsWith('/') && u.pathname !== '/') {
      href = href.slice(0, -1)
    }
    return href
  } catch {
    return url
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

module.exports = { CrawlEngine }
