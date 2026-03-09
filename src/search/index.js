const { ddgSearch } = require('./engines/ddg')
const { braveSearch } = require('./engines/brave')
const { serperSearch } = require('./engines/serper')
const { scrapeUrls } = require('./scraper')

const ENGINES = {
  ddg: ddgSearch,
  brave: braveSearch,
  serper: serperSearch
}

class SearchEngine {
  constructor(config = {}, cache) {
    this.config = config
    this.cache = cache
    this.cascade = config.cascade || ['ddg', 'brave', 'serper']
    this.scrapeTop = config.scrapeTop || 3
  }

  /**
   * Search using the cascade strategy.
   * Tries free/unlimited engines first, escalates to quota-limited ones if needed.
   */
  async search(query, opts = {}) {
    // Check cache first
    const cacheKey = `${query}:${JSON.stringify(opts)}`
    const cached = this.cache?.get('search', cacheKey)
    if (cached) return { ...cached, cached: true }

    let results = []
    const minResults = opts.minResults || 5

    // Cascade through engines until we have enough results
    for (const engineName of this.cascade) {
      const engine = ENGINES[engineName]
      if (!engine) continue

      try {
        const engineResults = await engine(query, this.config[engineName] || {})
        results = dedupeResults([...results, ...engineResults])
        
        if (results.length >= minResults) break
      } catch (err) {
        console.warn(`Search engine ${engineName} failed:`, err.message)
        continue
      }
    }

    // Scrape top N results for full content
    const scrapeCount = opts.scrapeTop ?? this.scrapeTop
    if (scrapeCount > 0 && results.length > 0) {
      const urls = results.slice(0, scrapeCount).map(r => r.url)
      const scraped = await scrapeUrls(urls)
      
      for (const result of results) {
        const scrapedContent = scraped[result.url]
        if (scrapedContent) {
          result.fullContent = scrapedContent
        }
      }
    }

    // LLM summarization (optional)
    let answer = null
    if (opts.summarize && this.config.llm) {
      answer = await this._summarize(query, results)
    }

    const response = { answer, sources: results, cached: false }
    
    // Cache the result
    this.cache?.set('search', cacheKey, response)
    
    return response
  }

  async _summarize(query, results) {
    // TODO: implement LLM summarization
    // Will support: minimax, openai, anthropic, ollama
    return null
  }
}

function dedupeResults(results) {
  const seen = new Set()
  return results.filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })
}

module.exports = { SearchEngine }
