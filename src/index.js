/**
 * Spectrawl — The unified web layer for AI agents.
 * Search, browse, authenticate, act.
 */

const { SearchEngine } = require('./search')
const { BrowseEngine } = require('./browse')
const { AuthManager } = require('./auth')
const { ActEngine } = require('./act')
const { CrawlEngine } = require('./crawl')
const { ExtractEngine } = require('./extract')
const { AgentEngine } = require('./agent')
const { Cache } = require('./cache')
const { EventEmitter, EVENTS } = require('./events')
const { CookieRefresher } = require('./auth/refresh')
const { loadConfig } = require('./config')

function deepMergeConfig(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMergeConfig(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

class Spectrawl {
  constructor(configPath) {
    // Accept either a file path (string) or a config object
    this.config = (typeof configPath === 'object' && configPath !== null)
      ? deepMergeConfig(loadConfig(null), configPath)
      : loadConfig(configPath)
    this.events = new EventEmitter()
    this.cache = new Cache(this.config.cache)
    this.searchEngine = new SearchEngine(this.config.search, this.cache)
    this.browseEngine = new BrowseEngine(this.config.browse, this.cache)
    this.auth = new AuthManager(this.config.auth)
    this.actEngine = new ActEngine(this.config, this.auth, this.browseEngine)
    this.crawlEngine = new CrawlEngine(this.browseEngine, this.cache)
    this.extractEngine = new ExtractEngine(this.browseEngine, this.config.search)
    this.agentEngine = new AgentEngine(this.browseEngine, this.config.search)
    this.refresher = new CookieRefresher(this.auth, this.events, this.config.auth)
  }

  /**
   * Search the web using free API cascade.
   * @param {string} query - Search query
   * @param {object} opts - { summarize, scrapeTop, engines }
   * @returns {Promise<{answer?, sources[], cached}>}
   */
  async search(query, opts = {}) {
    return this.searchEngine.search(query, opts)
  }

  /**
   * Deep search — Tavily-equivalent "advanced" mode.
   * Query expansion → parallel search → rerank → scrape → AI answer with citations.
   * Requires GEMINI_API_KEY (free tier) or configured LLM.
   * @param {string} query - Search query
   * @param {object} opts - { scrapeTop, expand, rerank }
   * @returns {Promise<{answer, sources[], queries[], cached}>}
   */
  async deepSearch(query, opts = {}) {
    return this.searchEngine.deepSearch(query, opts)
  }

  /**
   * Browse a URL with stealth and optional auth.
   * @param {string} url - URL to browse
   * @param {object} opts - { auth, screenshot, extract, stealth }
   * @returns {Promise<{content, html, screenshot?, cookies?}>}
   */
  async browse(url, opts = {}) {
    if (opts.auth) {
      const cookies = await this.auth.getCookies(opts.auth)
      opts._cookies = cookies
    }
    return this.browseEngine.browse(url, opts)
  }

  /**
   * Crawl a website recursively. Returns clean markdown for every page.
   * Uses Jina Reader (free) with Playwright stealth fallback.
   * @param {string} url - Starting URL
   * @param {object} opts - { depth, maxPages, format, delay, stealth, scope, auth }
   * @returns {Promise<{pages[], stats, failed?}>}
   */
  async crawl(url, opts = {}) {
    let cookies = null
    if (opts.auth) {
      cookies = await this.auth.getCookies(opts.auth)
    }
    return this.crawlEngine.crawl(url, opts, cookies)
  }

  /**
   * Start an async crawl job. Returns job ID immediately.
   */
  startCrawlJob(url, opts = {}) {
    return this.crawlEngine.startJob(url, opts)
  }

  /**
   * Get crawl job status/results.
   */
  getCrawlJob(jobId) {
    return this.crawlEngine.getJob(jobId)
  }

  /**
   * List all crawl jobs.
   */
  listCrawlJobs() {
    return this.crawlEngine.listJobs()
  }

  /**
   * Extract structured data from a URL using LLM.
   * @param {string} url - URL to extract from
   * @param {object} opts - { instruction, schema, selector, relevanceFilter, model }
   * @returns {Promise<{data, url, title, contentLength, duration}>}
   */
  async extract(url, opts = {}) {
    return this.extractEngine.extract(url, opts)
  }

  /**
   * Extract from already-fetched content (no browsing).
   * @param {string} content - Page content
   * @param {object} opts - { instruction, schema, relevanceFilter }
   * @returns {Promise<{data}>}
   */
  async extractFromContent(content, opts = {}) {
    return this.extractEngine.extractFromContent(content, opts)
  }

  /**
   * Execute natural language browser actions.
   * @param {string} url - URL to navigate to
   * @param {string} instruction - what to do (e.g. "click the login button")
   * @param {object} opts - { maxSteps, screenshot, timeout }
   * @returns {Promise<{success, url, title, steps, content, screenshot?, duration}>}
   */
  async agent(url, instruction, opts = {}) {
    return this.agentEngine.act(url, instruction, opts)
  }

  /**
   * Perform an authenticated action on a platform.
   * @param {string} platform - Platform name (x, reddit, devto, etc.)
   * @param {string} action - Action name (post, comment, like, etc.)
   * @param {object} params - Action parameters
   * @returns {Promise<{success, data?, error?}>}
   */
  async act(platform, action, params = {}) {
    const result = await this.actEngine.execute(platform, action, params)
    
    if (result.success) {
      this.events.emit(EVENTS.ACTION_SUCCESS, { platform, action, ...result })
    } else {
      this.events.emit(EVENTS.ACTION_FAILED, { platform, action, ...result })
    }
    
    return result
  }

  /**
   * Register event handler.
   * Events: cookie_expiring, cookie_expired, auth_failed, auth_refreshed,
   *         rate_limited, action_failed, action_success, health_check
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  on(event, handler) {
    this.events.on(event, handler)
    return this
  }

  /**
   * Start the cookie refresh cron.
   * Call this when running as a server to auto-monitor auth health.
   */
  startRefreshCron() {
    this.refresher.start()
  }

  /**
   * Get health status of all authenticated sessions.
   * @returns {Promise<Array<{platform, account, status, expires?}>>}
   */
  async status() {
    return this.auth.getStatus()
  }

  /**
   * Shut down gracefully.
   */
  async close() {
    this.refresher.stop()
    await this.browseEngine.close()
    await this.cache.close()
  }
}

module.exports = { Spectrawl, EVENTS }
