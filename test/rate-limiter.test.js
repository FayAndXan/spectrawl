const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

describe('RateLimiter', () => {
  const { RateLimiter } = require('../src/act/rate-limiter')
  const testDbPath = path.join(__dirname, 'test-ratelimit.db')
  let limiter

  beforeEach(() => {
    limiter = new RateLimiter({
      dbPath: testDbPath,
      limits: {
        x: { postsPerHour: 3, minDelayMs: 1000 },
        reddit: { postsPerHour: 5 }
      }
    })
  })

  afterEach(() => {
    limiter.close()
    try { fs.unlinkSync(testDbPath) } catch {}
  })

  it('should allow actions under the limit', () => {
    const result = limiter.check('x', 'post')
    assert.equal(result.allowed, true)
  })

  it('should block actions over the limit', () => {
    // Log 3 successful posts
    for (let i = 0; i < 3; i++) {
      limiter.log('x', 'post', { status: 'success' })
    }

    const result = limiter.check('x', 'post')
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('Rate limit'))
    assert.ok(result.retryAfter > 0)
  })

  it('should allow actions on platforms without limits', () => {
    const result = limiter.check('devto', 'post')
    assert.equal(result.allowed, true)
  })

  it('should detect duplicates', () => {
    limiter.log('x', 'post', { contentHash: 'abc123', status: 'success' })
    
    assert.equal(limiter.isDuplicate('x', 'abc123'), true)
    assert.equal(limiter.isDuplicate('x', 'def456'), false)
  })

  it('should not count failed actions as duplicates', () => {
    limiter.log('x', 'post', { contentHash: 'abc123', status: 'failed' })
    assert.equal(limiter.isDuplicate('x', 'abc123'), false)
  })

  it('should enforce min delay', () => {
    limiter.log('x', 'post', { status: 'success' })
    
    const result = limiter.check('x', 'post')
    // Should be blocked due to minDelayMs
    assert.equal(result.allowed, false)
    assert.ok(result.reason.includes('Min delay'))
  })

  it('should track failed actions for dead letter queue', () => {
    limiter.log('x', 'post', { status: 'failed', error: 'timeout', retryCount: 1 })
    limiter.log('x', 'post', { status: 'failed', error: 'auth', retryCount: 2 })
    
    const failed = limiter.getFailedActions(3)
    assert.equal(failed.length, 2)
    assert.equal(failed[0].error, 'timeout')
  })

  it('should not return failed actions that exceeded max retries', () => {
    limiter.log('x', 'post', { status: 'failed', retryCount: 5 })
    
    const failed = limiter.getFailedActions(3)
    assert.equal(failed.length, 0)
  })
})
