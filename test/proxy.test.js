const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')

describe('ProxyServer', () => {
  const { ProxyServer } = require('../src/proxy')
  let server

  after(() => {
    if (server) server.stop()
  })

  it('should initialize with config', () => {
    server = new ProxyServer({
      port: 18181,
      upstreams: [{ url: 'http://test:pass@example.com:8080' }],
      strategy: 'round-robin'
    })
    assert.ok(server)
    assert.equal(server.port, 18181)
    assert.equal(server.upstreams.length, 1)
  })

  it('should report stats', () => {
    const stats = server.stats()
    assert.equal(stats.total, 0)
    assert.equal(stats.success, 0)
    assert.equal(stats.failed, 0)
    assert.equal(stats.upstreams.length, 1)
    assert.equal(stats.upstreams[0].healthy, true)
  })

  it('should rotate with round-robin', () => {
    const multi = new ProxyServer({
      port: 18182,
      upstreams: [
        { url: 'http://proxy1.test:8080' },
        { url: 'http://proxy2.test:8080' },
        { url: 'http://proxy3.test:8080' }
      ],
      strategy: 'round-robin'
    })

    const picks = new Set()
    for (let i = 0; i < 6; i++) {
      const u = multi._nextUpstream()
      picks.add(u.url)
    }
    // Should have used all 3 upstreams
    assert.equal(picks.size, 3)
  })

  it('should skip failed upstreams', () => {
    const multi = new ProxyServer({
      port: 18183,
      upstreams: [
        { url: 'http://dead.test:8080' },
        { url: 'http://alive.test:8080' }
      ],
      maxFailures: 2
    })

    // Mark first as dead
    multi.upstreams[0].failures = 5
    multi.upstreams[0].lastFailure = Date.now()

    const u = multi._nextUpstream()
    assert.equal(u.url, 'http://alive.test:8080')
  })

  it('should reset all if everything is dead', () => {
    const multi = new ProxyServer({
      port: 18184,
      upstreams: [
        { url: 'http://dead1.test:8080' },
        { url: 'http://dead2.test:8080' }
      ],
      maxFailures: 2
    })

    multi.upstreams.forEach(u => {
      u.failures = 10
      u.lastFailure = Date.now()
    })

    const u = multi._nextUpstream()
    // Should reset and return first
    assert.ok(u)
    assert.equal(multi.upstreams[0].failures, 0)
  })
})
