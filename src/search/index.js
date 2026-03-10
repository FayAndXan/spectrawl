const { ddgSearch } = require('./engines/ddg')
const { braveSearch } = require('./engines/brave')
const { serperSearch } = require('./engines/serper')
const { searxngSearch } = require('./engines/searxng')
const { googleCseSearch } = require('./engines/google-cse')
const { jinaSearch } = require('./engines/jina')
const { bingSearch } = require('./engines/bing')
const { geminiGroundedSearch } = require('./engines/gemini-grounded')
const { scrapeUrls } = require('./scraper')
const { Summarizer } = require('./summarizer')
const { Reranker } = require('./reranker')
const { QueryExpander } = require('./query-expander')
const { SourceRanker } = require('./source-ranker')

const ENGINES = {
  searxng: searxngSearch,
  ddg: ddgSearch,
  brave: braveSearch,
  serper: serperSearch,
  'google-cse': googleCseSearch,
  jina: jinaSearch,
  'gemini-grounded': geminiGroundedSearch,
  gemini: geminiGroundedSearch,
  bing: bingSearch
}

class SearchEngine {
  constructor(config = {}, cache) {
    this.config = config
    this.cache = cache
    this.cascade = config.cascade || ['ddg', 'brave', 'serper']
    this.scrapeTop = config.scrapeTop || 5
    this.summarizer = config.llm ? new Summarizer(config.llm) : null
    
    // Gemini-powered features (free tier)
    const geminiKey = config.geminiKey || process.env.GEMINI_API_KEY
    this.reranker = geminiKey ? new Reranker({ apiKey: geminiKey, ...config.reranker }) : null
    this.expander = geminiKey ? new QueryExpander({ apiKey: geminiKey, ...config.expander }) : null
    this.sourceRanker = new SourceRanker(config.sourceRanker || {})
  }

  /**
   * Search using the cascade strategy.
   * Tries free/unlimited engines first, escalates to quota-limited ones if needed.
   */
  async search(query, opts = {}) {
    if (!query || !query.trim()) {
      throw new Error('Search query is required')
    }

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
    
    // Only cache if we got results
    if (results.length > 0) {
      this.cache?.set('search', cacheKey, response)
    }
    
    return response
  }

  /**
   * Deep search — Tavily-equivalent "advanced" mode.
   * Query expansion → parallel search → merge/dedup → rerank → scrape top N → summarize with citations.
   * 
   * Returns: { answer, sources: [{title, url, content, score}], cached }
   */
  async deepSearch(query, opts = {}) {
    if (!query || !query.trim()) {
      throw new Error('Search query is required')
    }

    // Check cache
    const cacheKey = `deep:${opts.mode || 'full'}:${query}`
    const cached = this.cache?.get('search', cacheKey)
    if (cached) return { ...cached, cached: true }

    // Step 1: Query expansion (skip if using Gemini grounded — it searches Google natively)
    let queries = [query]
    const usesGrounded = this.cascade.includes('gemini-grounded') || this.cascade.includes('gemini')
    if (this.expander && opts.expand !== false && !usesGrounded) {
      queries = await this.expander.expand(query)
    }

    // Step 2: Search across all query variants
    // When using Gemini Grounded, also run DDG in parallel for volume
    const resultSets = []
    if (usesGrounded) {
      // Parallel with staggered DDG start (DDG rate-limits concurrent requests from same IP)
      const delay = ms => new Promise(r => setTimeout(r, ms))
      const [groundedResults, ddgResults] = await Promise.all([
        this._rawSearch(query, { ...opts, engines: ['gemini-grounded', 'gemini'] }).catch(e => { console.warn('Gemini grounded failed:', e.message); return [] }),
        delay(500).then(() => this._rawSearch(query, { ...opts, engines: ['ddg'] })).catch(e => { console.warn('DDG failed:', e.message); return [] })
      ])
      if (process.env.SPECTRAWL_DEBUG) {
        console.log('[deepSearch] Gemini results:', groundedResults.length, '| DDG results:', ddgResults.length)
      }
      resultSets.push(groundedResults, ddgResults)
      
      // If primary failed, retry with a different approach
      if (groundedResults.length === 0 && ddgResults.length === 0) {
        await delay(1000)
        const retry = await this._rawSearch(query, { ...opts, engines: this.cascade }).catch(() => [])
        resultSets.push(retry)
      }
    } else {
      for (const q of queries) {
        try {
          const r = await this._rawSearch(q, opts)
          resultSets.push(r)
        } catch (e) {
          resultSets.push([])
        }
        if (queries.length > 1) await new Promise(r => setTimeout(r, 300))
      }
    }

    // Step 3: Merge and deduplicate
    const flatResults = resultSets.flat()
    let results = dedupeResults(flatResults)
    if (process.env.SPECTRAWL_DEBUG) {
      console.log('[deepSearch] resultSets lengths:', resultSets.map(s => s.length))
      console.log('[deepSearch] flat:', flatResults.length, '→ deduped:', results.length)
    }

    // Step 4a: Rerank by relevance (skip for Gemini Grounded — it already returns scored results)
    if (this.reranker && opts.rerank !== false && !usesGrounded) {
      results = await this.reranker.rerank(query, results)
    }

    // Step 4b: Source quality ranking — boost trusted domains, penalize SEO spam
    results = this.sourceRanker.rank(results)

    // Step 5: Parallel scrape top N for full content (skip in fast mode)
    const scrapeCount = opts.mode === 'fast' ? 0 : (opts.scrapeTop ?? this.scrapeTop ?? 5)
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

    // Step 6: Summarize with citations
    let answer = null
    const summarizer = this.summarizer || (this.reranker ? new Summarizer({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: process.env.GEMINI_API_KEY
    }) : null)

    if (summarizer) {
      answer = await summarizer.summarize(query, results)
    }

    const response = {
      answer,
      sources: results.map((r, i) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        content: r.fullContent?.slice(0, 2000) || r.snippet || '',
        score: r.score || r.confidence || Math.max(0.5, 1 - (i * 0.05))
      })),
      queries, // show which queries were used
      cached: false
    }

    // Only cache if we got results — never cache failures
    if (response.sources.length > 0) {
      this.cache?.set('search', cacheKey, response)
    }
    return response
  }

  /**
   * Raw search without reranking or summarization.
   * Used internally by deepSearch for parallel query variants.
   */
  async _rawSearch(query, opts = {}) {
    let results = []
    const minResults = opts.minResults || 5
    const cascade = opts.engines || this.cascade

    for (const engineName of cascade) {
      const engine = ENGINES[engineName]
      if (!engine) continue

      try {
        const engineResults = await engine(query, this.config[engineName] || {})
        results = dedupeResults([...results, ...engineResults])
        if (results.length >= minResults) break
      } catch (err) {
        continue
      }
    }

    return results
  }

  async _summarize(query, results) {
    if (!this.summarizer) return null
    return this.summarizer.summarize(query, results)
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
