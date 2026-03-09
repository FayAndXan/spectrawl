/**
 * Browse engine — three tiers of stealth.
 * 
 * Tier 1: playwright-extra + stealth plugin (default, npm install)
 * Tier 2: Camoufox binary (npx spectrawl install-stealth, engine-level anti-detect)
 * Tier 3: Remote Camoufox service (set camoufox.url, for existing deployments)
 * 
 * Auto-detects best available. No config needed for most users.
 */

const os = require('os')
const path = require('path')
const { CamoufoxClient } = require('./camoufox')
const { getCamoufoxPath, isInstalled } = require('./install-stealth')

class BrowseEngine {
  constructor(config = {}, cache) {
    this.config = config
    this.cache = cache
    this.browser = null

    // Remote Camoufox service (existing deployment)
    this.remoteCamoufox = config.camoufox?.url ? new CamoufoxClient(config.camoufox) : null
    this._remoteCamoufoxAvailable = null

    // Which engine we're using
    this._engine = null
  }

  /**
   * Browse a URL and extract content.
   */
  async browse(url, opts = {}) {
    if (!opts.noCache && !opts.screenshot) {
      const cached = this.cache?.get('scrape', url)
      if (cached) return { ...cached, cached: true }
    }

    // Force remote Camoufox if explicitly requested
    if (opts.camoufox && this.remoteCamoufox) {
      return this._browseRemoteCamoufox(url, opts)
    }

    try {
      return await this._browsePlaywright(url, opts)
    } catch (err) {
      // If blocked and remote Camoufox available, try that
      if (this._isBlocked(err) && this.remoteCamoufox) {
        console.log(`Blocked on ${url}, escalating to remote Camoufox`)
        return this._browseRemoteCamoufox(url, opts)
      }

      if (this._isBlocked(err)) {
        const hint = isInstalled()
          ? 'Site has strong anti-bot. Try configuring a residential proxy.'
          : 'Run `npx spectrawl install-stealth` for engine-level anti-detect.'
        err.message = `Blocked on ${url}: ${err.message}. ${hint}`
      }
      throw err
    }
  }

  /**
   * Launch Playwright with the best available browser.
   * Priority: Camoufox binary > stealth Chromium > vanilla Chromium
   */
  async _getBrowser() {
    if (this.browser) return this.browser

    // Tier 2: Local Camoufox binary (engine-level anti-detect)
    const camoufoxBinary = getCamoufoxPath()
    if (camoufoxBinary) {
      try {
        const { firefox } = require('playwright')
        this.browser = await firefox.launch({
          executablePath: camoufoxBinary,
          headless: true,
          args: ['--no-remote']
        })
        this._engine = 'camoufox'
        console.log('Browse engine: Camoufox (engine-level anti-detect)')
        return this.browser
      } catch (e) {
        console.log(`Camoufox binary failed: ${e.message}, falling back`)
      }
    }

    // Tier 1: playwright-extra + stealth plugin
    try {
      const { chromium } = require('playwright-extra')
      const stealth = require('puppeteer-extra-plugin-stealth')
      chromium.use(stealth())

      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      this._engine = 'stealth-playwright'
      console.log('Browse engine: stealth Playwright (JS-level anti-detect)')
      return this.browser
    } catch (e) {
      // Tier 0: vanilla playwright
      const { chromium } = require('playwright')
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      this._engine = 'playwright'
      console.log('Browse engine: vanilla Playwright (no anti-detect — install playwright-extra)')
      return this.browser
    }
  }

  async _browsePlaywright(url, opts) {
    const browser = await this._getBrowser()
    const context = await this._createContext(browser, opts)
    const page = await context.newPage()

    try {
      if (opts._cookies) {
        await context.addCookies(opts._cookies)
      }

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Human-like delays
      await page.waitForTimeout(800 + Math.random() * 1500)
      await page.evaluate(() => {
        window.scrollBy({ top: Math.floor(Math.random() * 400) + 100, behavior: 'smooth' })
      })
      await page.waitForTimeout(300 + Math.random() * 700)

      const result = {}

      if (opts.extract !== false) {
        result.content = await page.evaluate(() => {
          const main = document.querySelector('main, article, [role="main"]') || document.body
          return main.innerText
        })
      }

      if (opts.html) result.html = await page.content()

      if (opts.screenshot) {
        result.screenshot = await page.screenshot({
          type: 'png', fullPage: opts.fullPage || false
        })
      }

      if (opts.saveCookies) result.cookies = await context.cookies()

      result.url = page.url()
      result.title = await page.title()
      result.cached = false
      result.engine = this._engine

      if (!opts.screenshot) {
        this.cache?.set('scrape', url, { content: result.content, url: result.url, title: result.title })
      }

      return result
    } finally {
      await page.close()
      await context.close()
    }
  }

  async _browseRemoteCamoufox(url, opts) {
    if (this._remoteCamoufoxAvailable === null) {
      const health = await this.remoteCamoufox.health()
      this._remoteCamoufoxAvailable = health.available
    }

    if (!this._remoteCamoufoxAvailable) {
      throw new Error('Remote Camoufox configured but not running. Check camoufox.url.')
    }

    if (opts._cookies) await this.remoteCamoufox.setCookies(opts._cookies)
    await this.remoteCamoufox.navigate(url, { wait: 3000 })

    const result = { engine: 'remote-camoufox', cached: false }

    if (opts.extract !== false) {
      const textData = await this.remoteCamoufox.getText()
      result.content = textData.text
      result.title = textData.title
      result.url = textData.url
    }

    if (opts.screenshot) {
      const ssData = await this.remoteCamoufox.screenshot()
      result.screenshotPath = ssData.path
    }

    if (!opts.screenshot) {
      this.cache?.set('scrape', url, { content: result.content, url: result.url, title: result.title })
    }

    return result
  }

  _isBlocked(err) {
    const msg = (err.message || '').toLowerCase()
    return msg.includes('captcha') || msg.includes('blocked') || msg.includes('403') ||
           msg.includes('access denied') || msg.includes('challenge') ||
           msg.includes('cloudflare') || msg.includes('bot detection')
  }

  async _createContext(browser, opts) {
    const resolutions = [
      { width: 1920, height: 1080 }, { width: 1536, height: 864 },
      { width: 1440, height: 900 }, { width: 1366, height: 768 },
      { width: 2560, height: 1440 }
    ]
    const viewport = resolutions[Math.floor(Math.random() * resolutions.length)]

    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
    ]

    const contextOpts = {
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
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

  /**
   * Get a raw Playwright page for direct interaction.
   * Used by platform adapters that need browser automation (e.g., IH).
   * Caller is responsible for closing the page and context.
   * 
   * @param {object} opts - { _cookies, url }
   * @returns {{ page, context, engine }}
   */
  async getPage(opts = {}) {
    const browser = await this._getBrowser()
    const context = await this._createContext(browser, opts)

    if (opts._cookies) {
      await context.addCookies(opts._cookies)
    }

    const page = await context.newPage()

    if (opts.url) {
      await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(800 + Math.random() * 1500)
    }

    return { page, context, engine: this._engine }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

module.exports = { BrowseEngine }
