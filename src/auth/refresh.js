/**
 * Cookie refresh cron.
 * Periodically checks cookie validity and refreshes when needed.
 */

class CookieRefresher {
  constructor(authManager, events, config = {}) {
    this.auth = authManager
    this.events = events
    this.interval = config.refreshInterval || 14400 // 4h default
    this.warningThreshold = config.warningThreshold || 7200 // 2h before expiry
    this._timer = null
  }

  /**
   * Start the refresh cron.
   */
  start() {
    if (this._timer) return
    
    // Run immediately, then on interval
    this._check()
    this._timer = setInterval(() => this._check(), this.interval * 1000)
    
    console.log(`Cookie refresh cron started (every ${this.interval}s)`)
  }

  /**
   * Stop the refresh cron.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  async _check() {
    try {
      const accounts = await this.auth.getStatus()
      const now = Math.floor(Date.now() / 1000)

      for (const account of accounts) {
        if (account.status === 'expired') {
          this.events.emit('cookie_expired', {
            platform: account.platform,
            account: account.account,
            expiredAt: account.expiresAt
          })

          // Attempt auto-refresh
          await this._tryRefresh(account)
        } else if (account.status === 'expiring') {
          const remaining = account.expiresAt 
            ? Math.floor((new Date(account.expiresAt).getTime() / 1000) - now)
            : 0

          this.events.emit('cookie_expiring', {
            platform: account.platform,
            account: account.account,
            expiresIn: remaining,
            expiresAt: account.expiresAt
          })
        }
      }
    } catch (err) {
      console.warn('Cookie refresh check failed:', err.message)
    }
  }

  async _tryRefresh(account) {
    // Platform-specific refresh strategies
    try {
      switch (account.method) {
        case 'oauth':
          await this._refreshOAuth(account)
          break
        case 'cookie':
          // Can't auto-refresh cookies without browser
          // Emit event so user/agent knows
          this.events.emit('auth_failed', {
            platform: account.platform,
            account: account.account,
            reason: 'Cookie expired. Manual re-login required.',
            suggestion: `Run: spectrawl login ${account.platform} --account ${account.account}`
          })
          break
      }
    } catch (err) {
      this.events.emit('auth_failed', {
        platform: account.platform,
        account: account.account,
        reason: err.message,
        suggestion: `Run: spectrawl login ${account.platform} --account ${account.account}`
      })
    }
  }

  async _refreshOAuth(account) {
    // TODO: implement OAuth token refresh per platform
    // For now, emit that refresh is needed
    this.events.emit('auth_failed', {
      platform: account.platform,
      account: account.account,
      reason: 'OAuth refresh not yet implemented',
      suggestion: `Run: spectrawl login ${account.platform} --oauth`
    })
  }
}

module.exports = { CookieRefresher }
