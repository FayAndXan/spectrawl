/**
 * Browse engine — stealth web browsing with escalation.
 * Playwright (fast) → Camoufox (stealth) when blocked.
 */

class BrowseEngine {
  constructor(config = {}, cache) {
    this.config = config
    this.cache = cache
    this.browser = null
  }

  /**
   * Browse a URL and extract content.
   * @param {string} url
   * @param {object} opts - { auth, screenshot, extract, stealth, _cookies }
   */
  async browse(url, opts = {}) {
    // Check cache
    if (!opts.noCache) {
      const cached = this.cache?.get('scrape', url)
      if (cached && !opts.screenshot) return { ...cached, cached: true }
    }

    const browser = await this._getBrowser(opts.stealth)
    const context = await this._createContext(browser, opts)
    const page = await context.newPage()

    try {
      // Inject cookies if auth provided
      if (opts._cookies) {
        await context.addCookies(opts._cookies)
      }

      // Human-like behavior
      if (this.config.humanlike?.scrollBehavior) {
        await this._humanlikeNav(page, url)
      } else {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      }

      const result = {}

      // Extract text content
      if (opts.extract !== false) {
        result.content = await page.evaluate(() => {
          const main = document.querySelector('main, article, [role="main"]') || document.body
          return main.innerText
        })
      }

      // Get HTML
      if (opts.html) {
        result.html = await page.content()
      }

      // Screenshot
      if (opts.screenshot) {
        result.screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: opts.fullPage || false
        })
      }

      // Get current cookies (for auth persistence)
      if (opts.saveCookies) {
        result.cookies = await context.cookies()
      }

      result.url = page.url()
      result.title = await page.title()
      result.cached = false

      // Cache content (not screenshots)
      if (!opts.screenshot) {
        this.cache?.set('scrape', url, { content: result.content, url: result.url, title: result.title })
      }

      return result
    } finally {
      await page.close()
      await context.close()
    }
  }

  async _getBrowser(stealth) {
    if (this.browser) return this.browser

    // TODO: support Camoufox for stealth mode
    const { chromium } = require('playwright')
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    return this.browser
  }

  async _createContext(browser, opts) {
    const contextOpts = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    }

    if (this.config.proxy) {
      contextOpts.proxy = {
        server: `${this.config.proxy.host}:${this.config.proxy.port}`,
        username: this.config.proxy.username,
        password: this.config.proxy.password
      }
    }

    return browser.newContext(contextOpts)
  }

  async _humanlikeNav(page, url) {
    const delay = this.config.humanlike || {}
    const min = delay.minDelay || 500
    const max = delay.maxDelay || 2000

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    
    // Random delay before interaction
    await page.waitForTimeout(min + Math.random() * (max - min))
    
    // Scroll down naturally
    if (delay.scrollBehavior) {
      await page.evaluate(async () => {
        const distance = Math.floor(Math.random() * 500) + 200
        window.scrollBy({ top: distance, behavior: 'smooth' })
      })
      await page.waitForTimeout(min + Math.random() * (max - min))
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

module.exports = { BrowseEngine }
