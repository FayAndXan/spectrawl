/**
 * Spectrawl — The unified web layer for AI agents.
 * Search, browse, authenticate, act.
 */

const { SearchEngine } = require('./search')
const { BrowseEngine } = require('./browse')
const { AuthManager } = require('./auth')
const { ActEngine } = require('./act')
const { Cache } = require('./cache')
const { loadConfig } = require('./config')

class Spectrawl {
  constructor(configPath) {
    this.config = loadConfig(configPath)
    this.cache = new Cache(this.config.cache)
    this.searchEngine = new SearchEngine(this.config.search, this.cache)
    this.browseEngine = new BrowseEngine(this.config.browse, this.cache)
    this.auth = new AuthManager(this.config.auth)
    this.actEngine = new ActEngine(this.config, this.auth, this.browseEngine)
    
    this._eventHandlers = {}
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
   * Perform an authenticated action on a platform.
   * @param {string} platform - Platform name (x, reddit, ih, etc.)
   * @param {string} action - Action name (post, comment, like, etc.)
   * @param {object} params - Action parameters
   * @returns {Promise<{success, data?, error?}>}
   */
  async act(platform, action, params = {}) {
    return this.actEngine.execute(platform, action, params)
  }

  /**
   * Register event handler.
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   */
  on(event, handler) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = []
    this._eventHandlers[event].push(handler)
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
    await this.browseEngine.close()
    await this.cache.close()
  }
}

module.exports = { Spectrawl }
