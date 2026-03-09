const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

class Cache {
  constructor(config = {}) {
    const dbPath = config.path || './data/cache.db'
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.ttls = {
      search: config.searchTtl || 3600,
      scrape: config.scrapeTtl || 86400,
      screenshot: config.screenshotTtl || 3600
    }
    
    this._init()
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        ttl INTEGER NOT NULL
      )
    `)
    
    // Clean expired entries on startup
    this.db.prepare('DELETE FROM cache WHERE created_at + ttl < ?').run(now())
  }

  get(type, key) {
    const hash = this._hash(type, key)
    const row = this.db.prepare(
      'SELECT value FROM cache WHERE key = ? AND created_at + ttl > ?'
    ).get(hash, now())
    
    return row ? JSON.parse(row.value) : null
  }

  set(type, key, value) {
    const hash = this._hash(type, key)
    const ttl = this.ttls[type] || 3600
    
    this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, type, value, created_at, ttl)
      VALUES (?, ?, ?, ?, ?)
    `).run(hash, type, JSON.stringify(value), now(), ttl)
  }

  invalidate(type, key) {
    const hash = this._hash(type, key)
    this.db.prepare('DELETE FROM cache WHERE key = ?').run(hash)
  }

  clear(type) {
    if (type) {
      this.db.prepare('DELETE FROM cache WHERE type = ?').run(type)
    } else {
      this.db.prepare('DELETE FROM cache').run()
    }
  }

  close() {
    this.db.close()
  }

  _hash(type, key) {
    return crypto.createHash('sha256').update(`${type}:${key}`).digest('hex')
  }
}

function now() {
  return Math.floor(Date.now() / 1000)
}

module.exports = { Cache }
