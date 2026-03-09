const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Config', () => {
  const { loadConfig, DEFAULTS } = require('../src/config')

  it('should have sensible defaults', () => {
    assert.equal(DEFAULTS.port, 3900)
    assert.ok(Array.isArray(DEFAULTS.search.cascade))
    assert.ok(DEFAULTS.search.cascade.length > 0)
    assert.ok(DEFAULTS.cache.searchTtl > 0)
    assert.ok(DEFAULTS.cache.scrapeTtl > 0)
  })

  it('should load config and merge with defaults', () => {
    const config = loadConfig()
    assert.ok(config.port)
    assert.ok(config.search)
    assert.ok(config.cache)
  })
})

describe('Events', () => {
  const { EventEmitter } = require('../src/events')

  it('should emit and receive events', (_, done) => {
    const emitter = new EventEmitter()
    emitter.on('test_event', (data) => {
      assert.equal(data.hello, 'world')
      done()
    })
    emitter.emit('test_event', { hello: 'world' })
  })

  it('should support multiple listeners', () => {
    const emitter = new EventEmitter()
    let count = 0
    emitter.on('multi', () => count++)
    emitter.on('multi', () => count++)
    emitter.emit('multi', {})
    assert.equal(count, 2)
  })
})
