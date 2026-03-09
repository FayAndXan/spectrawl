/**
 * Browse engine — stealth web browsing built in.
 * 
 * Default: playwright-extra + stealth plugin (npm install, works everywhere)
 * Optional: Camoufox HTTP client (deeper anti-detect, requires external service)
 * 
 * Escalation: stealth playwright → Camoufox (if configured) → error with context
 */

const { CamoufoxClient } = require('./camoufox')

class BrowseEngine {
  constructor(config = {}, cache) {
    this.config = config
    this.cache = cache
    this.browser = null
    this.camoufox = config.camoufox?.url ? new CamoufoxClient(config.camoufox) : null
    this._camoufoxAvailable = null
  }

  /**
   * Browse a URL and extract content.
   * Stealth is ALWAYS on — no "stealth: true" flag needed.
   */
  async browse(url, opts = {}) {
    if (!opts.noCache && !opts.screenshot) {
      const cached = this.cache?.get('scrape', url)
      if (cached) return { ...cached, cached: true }
    }

    // Force Camoufox if explicitly requested and available
    if (opts.camoufox && this.camoufox) {
      return this._browseCamoufox(url, opts)
    }

    // Default: stealth Playwright
    try {
      return await this._browseStealthPlaywright(url, opts)
    } catch (err) {
      // If blocked, try Camoufox as fallback
      if (this._isBlocked(err) && this.camoufox) {
        console.log(`Stealth Playwright blocked on ${url}, escalating to Camoufox`)
        return this._browseCamoufox(url, opts)
      }

      // No Camoufox fallback — return error with context
      if (this._isBlocked(err)) {
        err.message = `Blocked on ${url}: ${err.message}. For deeper stealth, configure camoufox.url in spectrawl.json`
      }
      throw err
    }
  }

  /**
   * Stealth Playwright — default browse engine.
   * Uses playwright-extra + stealth plugin for anti-detection.
   */
  async _browseStealthPlaywright(url, opts) {
    const browser = await this._getBrowser()
    const context = await this._createContext(browser, opts)
    const page = await context.newPage()

    try {
      if (opts._cookies) {
        await context.addCookies(opts._cookies)
      }

      // Human-like navigation
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      
      // Random delay (humans don't instant-scrape)
      const delay = 800 + Math.random() * 1500
      await page.waitForTimeout(delay)

      // Random scroll (triggers lazy-loaded content + looks human)
      await page.evaluate(() => {
        const distance = Math.floor(Math.random() * 400) + 100
        window.scrollBy({ top: distance, behavior: 'smooth' })
      })
      await page.waitForTimeout(300 + Math.random() * 700)

      const result = {}

      if (opts.extract !== false) {
        result.content = await page.evaluate(() => {
          const main = document.querySelector('main, article, [role="main"]') || document.body
          return main.innerText
        })
      }

      if (opts.html) {
        result.html = await page.content()
      }

      if (opts.screenshot) {
        result.screenshot = await page.screenshot({
          type: 'png',
          fullPage: opts.fullPage || false
        })
      }

      if (opts.saveCookies) {
        result.cookies = await context.cookies()
      }

      result.url = page.url()
      result.title = await page.title()
      result.cached = false
      result.engine = 'stealth-playwright'

      if (!opts.screenshot) {
        this.cache?.set('scrape', url, { content: result.content, url: result.url, title: result.title })
      }

      return result
    } finally {
      await page.close()
      await context.close()
    }
  }

  /**
   * Camoufox — optional deep anti-detect.
   * Requires external Camoufox service (set camoufox.url in config).
   */
  async _browseCamoufox(url, opts) {
    if (this._camoufoxAvailable === null) {
      const health = await this.camoufox.health()
      this._camoufoxAvailable = health.available
    }

    if (!this._camoufoxAvailable) {
      throw new Error('Camoufox configured but not running. Check your camoufox.url setting.')
    }

    if (opts._cookies) {
      await this.camoufox.setCookies(opts._cookies)
    }

    await this.camoufox.navigate(url, { wait: 3000 })

    const result = { engine: 'camoufox', cached: false }

    if (opts.extract !== false) {
      const textData = await this.camoufox.getText()
      result.content = textData.text
      result.title = textData.title
      result.url = textData.url
    }

    if (opts.screenshot) {
      const ssData = await this.camoufox.screenshot()
      result.screenshotPath = ssData.path
    }

    if (!opts.screenshot) {
      this.cache?.set('scrape', url, { content: result.content, url: result.url, title: result.title })
    }

    return result
  }

  _isBlocked(err) {
    const msg = (err.message || '').toLowerCase()
    return msg.includes('captcha') ||
           msg.includes('blocked') ||
           msg.includes('403') ||
           msg.includes('access denied') ||
           msg.includes('challenge') ||
           msg.includes('cloudflare') ||
           msg.includes('bot detection')
  }

  async _getBrowser() {
    if (this.browser) return this.browser

    try {
      // Try playwright-extra with stealth (preferred)
      const { chromium } = require('playwright-extra')
      const stealth = require('puppeteer-extra-plugin-stealth')
      chromium.use(stealth())

      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      console.log('Browse engine: stealth playwright (anti-detect ON)')
    } catch (e) {
      // Fallback to vanilla playwright
      const { chromium } = require('playwright')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      console.log('Browse engine: vanilla playwright (install playwright-extra for stealth)')
    }

    return this.browser
  }

  async _createContext(browser, opts) {
    // Randomized but realistic fingerprint
    const resolutions = [
      { width: 1920, height: 1080 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 2560, height: 1440 }
    ]
    const viewport = resolutions[Math.floor(Math.random() * resolutions.length)]

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
    ]
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

    const contextOpts = {
      userAgent,
      viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'light',
      deviceScaleFactor: Math.random() > 0.5 ? 1 : 2
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

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

module.exports = { BrowseEngine }
