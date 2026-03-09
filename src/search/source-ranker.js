/**
 * Source quality ranker — boost trusted sources, penalize SEO spam.
 * This is something Tavily doesn't have.
 * 
 * Users can customize weights per domain or use built-in presets.
 */

// Built-in domain quality tiers
const DEFAULT_WEIGHTS = {
  // Tier 1: Primary sources, high trust (1.3x boost)
  'github.com': 1.3,
  'stackoverflow.com': 1.3,
  'news.ycombinator.com': 1.3,
  'arxiv.org': 1.3,
  'docs.google.com': 1.2,
  'developer.mozilla.org': 1.3,
  'wikipedia.org': 1.2,
  'en.wikipedia.org': 1.2,

  // Tier 2: Quality community/editorial (1.15x boost)
  'reddit.com': 1.15,
  'www.reddit.com': 1.15,
  'dev.to': 1.15,
  'medium.com': 1.1,
  'blog.logrocket.com': 1.15,
  'css-tricks.com': 1.15,
  'smashingmagazine.com': 1.15,
  'web.dev': 1.2,
  'npmjs.com': 1.15,
  'www.npmjs.com': 1.15,
  'pypi.org': 1.15,

  // Tier 3: Known SEO farms / thin content (0.7x penalty)
  'w3schools.com': 0.8,
  'www.w3schools.com': 0.8,
  'geeksforgeeks.org': 0.85,
  'www.geeksforgeeks.org': 0.85,
  'tutorialspoint.com': 0.7,
  'www.tutorialspoint.com': 0.7,
  'javatpoint.com': 0.7,
  'www.javatpoint.com': 0.7,
}

// Content-type signals that indicate quality
const QUALITY_SIGNALS = {
  // URL patterns that suggest high quality
  positive: [
    /\/blog\//i,          // Blog posts (usually more detailed)
    /\/docs\//i,          // Documentation
    /\/guide/i,           // Guides
    /\/tutorial/i,        // Tutorials
    /github\.com\/[\w-]+\/[\w-]+$/,  // Repo pages (not search)
    /\/wiki\//i,          // Wiki pages
    /\/research\//i,      // Research
  ],
  // URL patterns that suggest low quality
  negative: [
    /\/tag\//i,           // Tag listing pages
    /\/category\//i,      // Category pages
    /\/page\/\d+/i,       // Pagination
    /\?utm_/i,            // Tracking URLs
    /\/amp\//i,           // AMP pages (usually stripped)
    /\/slideshow/i,       // Slideshow spam
    /\/gallery/i,         // Gallery spam
    /\/listicle/i,        // Listicle spam
  ]
}

class SourceRanker {
  constructor(config = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...(config.weights || {}) }
    this.boostDomains = config.boost || []   // Always boost these domains
    this.blockDomains = config.block || []   // Always exclude these domains
  }

  /**
   * Apply source quality scoring to search results.
   * Modifies scores in-place and reorders by adjusted score.
   */
  rank(results) {
    if (!results || results.length === 0) return results

    // Filter blocked domains
    let filtered = results.filter(r => {
      try {
        const host = new URL(r.url).hostname
        return !this.blockDomains.some(d => host.includes(d))
      } catch { return true }
    })

    // Apply quality weights
    filtered = filtered.map(r => {
      let multiplier = 1.0

      try {
        const url = new URL(r.url)
        const host = url.hostname

        // Domain weight
        for (const [domain, weight] of Object.entries(this.weights)) {
          if (host === domain || host.endsWith('.' + domain)) {
            multiplier *= weight
            break
          }
        }

        // Boost domains
        if (this.boostDomains.some(d => host.includes(d))) {
          multiplier *= 1.3
        }

        // URL quality signals
        const fullUrl = r.url
        for (const pattern of QUALITY_SIGNALS.positive) {
          if (pattern.test(fullUrl)) { multiplier *= 1.05; break }
        }
        for (const pattern of QUALITY_SIGNALS.negative) {
          if (pattern.test(fullUrl)) { multiplier *= 0.85; break }
        }

        // Freshness signal (year in URL)
        const yearMatch = fullUrl.match(/20(2[4-9]|3\d)/)
        if (yearMatch) multiplier *= 1.05  // Recent content boost

      } catch { /* invalid URL, no adjustment */ }

      const baseScore = r.score || r.confidence || 0.5
      return { ...r, score: Math.min(1, baseScore * multiplier), _multiplier: multiplier }
    })

    // Sort by adjusted score
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0))

    return filtered
  }
}

module.exports = { SourceRanker, DEFAULT_WEIGHTS }
