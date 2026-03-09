const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

class AuthManager {
  constructor(config = {}) {
    const dbPath = config.cookieStore || './data/cookies.db'
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.refreshInterval = parseInterval(config.refreshInterval || '4h')
    
    this._init()
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        account TEXT NOT NULL,
        method TEXT NOT NULL,
        cookies TEXT,
        oauth_token TEXT,
        oauth_refresh TEXT,
        credentials TEXT,
        status TEXT DEFAULT 'unknown',
        last_check INTEGER,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(platform, account)
      )
    `)
  }

  /**
   * Add a new account.
   */
  async add(platform, opts = {}) {
    const id = `${platform}:${opts.account}`
    const now = Math.floor(Date.now() / 1000)
    
    this.db.prepare(`
      INSERT OR REPLACE INTO accounts 
      (id, platform, account, method, cookies, oauth_token, oauth_refresh, credentials, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, platform, opts.account, opts.method || 'cookie',
      opts.cookies ? JSON.stringify(opts.cookies) : null,
      opts.oauthToken || null,
      opts.oauthRefresh || null,
      opts.credentials ? JSON.stringify(opts.credentials) : null,
      'valid', now, now
    )

    return { id, platform, account: opts.account, status: 'valid' }
  }

  /**
   * Get cookies for a platform/account.
   */
  async getCookies(platformOrId, account) {
    let row
    if (account) {
      row = this.db.prepare('SELECT * FROM accounts WHERE platform = ? AND account = ?').get(platformOrId, account)
    } else {
      // Try as id first, then as platform (return first account)
      row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(platformOrId) ||
            this.db.prepare('SELECT * FROM accounts WHERE platform = ? ORDER BY updated_at DESC LIMIT 1').get(platformOrId)
    }

    if (!row) return null
    if (row.cookies) return JSON.parse(row.cookies)
    return null
  }

  /**
   * Update cookies for an account.
   */
  async updateCookies(platform, account, cookies, expiresAt) {
    const now = Math.floor(Date.now() / 1000)
    this.db.prepare(`
      UPDATE accounts SET cookies = ?, status = 'valid', expires_at = ?, updated_at = ?, last_check = ?
      WHERE platform = ? AND account = ?
    `).run(JSON.stringify(cookies), expiresAt || null, now, now, platform, account)
  }

  /**
   * Get health status of all accounts.
   */
  async getStatus() {
    const rows = this.db.prepare('SELECT * FROM accounts ORDER BY platform, account').all()
    const now = Math.floor(Date.now() / 1000)

    return rows.map(row => {
      let status = row.status
      if (row.expires_at) {
        const remaining = row.expires_at - now
        if (remaining <= 0) status = 'expired'
        else if (remaining < 7200) status = 'expiring'
      }

      return {
        platform: row.platform,
        account: row.account,
        method: row.method,
        status,
        expiresAt: row.expires_at ? new Date(row.expires_at * 1000).toISOString() : null,
        lastCheck: row.last_check ? new Date(row.last_check * 1000).toISOString() : null
      }
    })
  }

  /**
   * Remove an account.
   */
  async remove(platform, account) {
    this.db.prepare('DELETE FROM accounts WHERE platform = ? AND account = ?').run(platform, account)
  }
}

function parseInterval(str) {
  const match = str.match(/^(\d+)(h|m|s)$/)
  if (!match) return 14400 // default 4h
  const [, num, unit] = match
  const multipliers = { h: 3600, m: 60, s: 1 }
  return parseInt(num) * (multipliers[unit] || 3600)
}

module.exports = { AuthManager }
