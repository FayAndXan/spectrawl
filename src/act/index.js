/**
 * Act engine — authenticated actions on platforms.
 * Delegates to platform-specific adapters.
 * Includes rate limiting, deduplication, and dead letter queue.
 */

const crypto = require('crypto')
const { XAdapter } = require('./adapters/x')
const { RedditAdapter } = require('./adapters/reddit')
const { DevtoAdapter } = require('./adapters/devto')
const { HashnodeAdapter } = require('./adapters/hashnode')
const { LinkedInAdapter } = require('./adapters/linkedin')
const { IHAdapter } = require('./adapters/ih')
const { RateLimiter } = require('./rate-limiter')

const adapters = {
  x: new XAdapter(),
  twitter: new XAdapter(),
  reddit: new RedditAdapter(),
  devto: new DevtoAdapter(),
  'dev.to': new DevtoAdapter(),
  hashnode: new HashnodeAdapter(),
  linkedin: new LinkedInAdapter(),
  ih: new IHAdapter(),
  indiehackers: new IHAdapter()
}

class ActEngine {
  constructor(config, auth, browse) {
    this.config = config
    this.auth = auth
    this.browse = browse
    this.rateLimiter = new RateLimiter({
      dbPath: config.cache?.path?.replace('cache.db', 'ratelimit.db') || './data/ratelimit.db',
      limits: config.rateLimit || {}
    })
  }

  /**
   * Execute an action on a platform.
   * @param {string} platform - Platform name
   * @param {string} action - Action name (post, comment, like, etc.)
   * @param {object} params - Action parameters
   */
  async execute(platform, action, params = {}) {
    const adapter = this._getAdapter(platform)
    if (!adapter) {
      return {
        success: false,
        error: 'unsupported_platform',
        detail: `No adapter for platform "${platform}". Supported: ${Object.keys(adapters).join(', ') || 'none yet'}`,
        suggestion: 'Platform adapters are being added. Check back soon.'
      }
    }

    const account = params.account

    // Check rate limits FIRST (no point checking auth if rate limited)
    const rateCheck = this.rateLimiter.check(platform, action, params)
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'rate_limited',
        detail: rateCheck.reason,
        retryAfter: rateCheck.retryAfter,
        suggestion: `Wait ${rateCheck.retryAfter}s or adjust limits in spectrawl.json`
      }
    }

    // Check deduplication (same content posted in last 24h)
    const contentHash = params.text || params.title || params.body
      ? crypto.createHash('md5').update(`${platform}:${action}:${params.text || ''}${params.title || ''}`).digest('hex')
      : null

    if (contentHash && this.rateLimiter.isDuplicate(platform, contentHash)) {
      return {
        success: false,
        error: 'duplicate',
        detail: `Same content already posted to ${platform} in the last 24h`,
        suggestion: 'Change the content or wait 24h'
      }
    }

    // Get auth for this platform/account
    if (account) {
      const cookies = await this.auth.getCookies(platform, account)
      if (!cookies) {
        return {
          success: false,
          error: 'auth_missing',
          detail: `No auth found for ${platform}/${account}.`,
          suggestion: `Run: spectrawl login ${platform} --account ${account}`
        }
      }
      params._cookies = cookies
    }

    try {
      const result = await adapter.execute(action, params, {
        auth: this.auth,
        browse: this.browse
      })

      // Log success
      this.rateLimiter.log(platform, action, {
        account, contentHash, status: 'success'
      })

      return { success: true, ...result }
    } catch (err) {
      // Log failure
      this.rateLimiter.log(platform, action, {
        account, contentHash, status: 'failed',
        error: err.message, retryCount: params._retryCount || 0
      })

      return {
        success: false,
        error: categorizeError(err),
        detail: err.message,
        suggestion: getSuggestion(err, platform, account)
      }
    }
  }

  _getAdapter(platform) {
    return adapters[platform] || null
  }

  /**
   * Register a platform adapter.
   */
  static registerAdapter(platform, adapter) {
    adapters[platform] = adapter
  }
}

function categorizeError(err) {
  const msg = err.message.toLowerCase()
  if (msg.includes('cookie') || msg.includes('auth') || msg.includes('login')) return 'auth_expired'
  if (msg.includes('captcha')) return 'captcha_required'
  if (msg.includes('rate') || msg.includes('429')) return 'rate_limited'
  if (msg.includes('fingerprint') || msg.includes('blocked')) return 'fingerprint_blocked'
  if (msg.includes('timeout')) return 'timeout'
  return 'unknown'
}

function getSuggestion(err, platform, account) {
  const category = categorizeError(err)
  const suggestions = {
    auth_expired: `Run: spectrawl login ${platform}${account ? ` --account ${account}` : ''}`,
    captcha_required: `Manual intervention needed. Run: spectrawl login ${platform} --manual`,
    rate_limited: `Wait and retry. Check rate limits in spectrawl.json`,
    fingerprint_blocked: `Try with stealth mode: spectrawl browse --stealth`,
    timeout: `Network issue. Check proxy settings.`
  }
  return suggestions[category] || 'Check logs for details.'
}

module.exports = { ActEngine }
