const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('Cache', () => {
  const { Cache } = require('../src/cache')
  const testDbPath = path.join(__dirname, 'test-cache.db')
  let cache

  beforeEach(() => {
    cache = new Cache({ path: testDbPath, searchTtl: 1, scrapeTtl: 1 })
  })

  afterEach(() => {
    cache.close()
    try { fs.unlinkSync(testDbPath) } catch {}
  })

  it('should store and retrieve search results', () => {
    const data = { sources: [{ url: 'https://example.com', title: 'Test' }] }
    cache.set('search', 'test query', data)
    const result = cache.get('search', 'test query')
    assert.deepEqual(result, data)
  })

  it('should store and retrieve scrape results', () => {
    const data = { content: 'Hello world', url: 'https://example.com' }
    cache.set('scrape', 'https://example.com', data)
    const result = cache.get('scrape', 'https://example.com')
    assert.deepEqual(result, data)
  })

  it('should return null for missing keys', () => {
    const result = cache.get('search', 'nonexistent')
    assert.equal(result, null)
  })

  it('should expire entries based on TTL', async () => {
    cache = new Cache({ path: testDbPath, searchTtl: 0.001 }) // ~3.6 seconds
    cache.set('search', 'expires', { data: true })
    
    // Should exist immediately
    assert.ok(cache.get('search', 'expires'))
    
    // Wait for expiry (TTL is in hours, 0.001h = 3.6s)
    await new Promise(r => setTimeout(r, 4000))
    assert.equal(cache.get('search', 'expires'), null)
  })

  it('should overwrite existing entries', () => {
    cache.set('search', 'q1', { a: 1 })
    cache.set('search', 'q1', { a: 2 })
    const result = cache.get('search', 'q1')
    assert.deepEqual(result, { a: 2 })
  })
})
