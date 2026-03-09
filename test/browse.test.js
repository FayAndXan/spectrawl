const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')

describe('BrowseEngine', () => {
  const { BrowseEngine } = require('../src/browse')
  let engine

  after(async () => {
    if (engine) await engine.close()
  })

  it('should initialize without config', () => {
    engine = new BrowseEngine({})
    assert.ok(engine)
  })

  it('should browse a URL and extract content', async () => {
    engine = new BrowseEngine({})
    const result = await engine.browse('https://httpbin.org/html')
    
    assert.ok(result.content)
    assert.ok(result.content.length > 0)
    assert.ok(result.url)
    assert.equal(result.cached, false)
    assert.ok(['stealth-playwright', 'camoufox', 'playwright'].includes(result.engine))
  })

  it('should cache results', async () => {
    const { Cache } = require('../src/cache')
    const cache = new Cache({ path: './test/test-browse-cache.db', searchTtl: 1, scrapeTtl: 1 })
    engine = new BrowseEngine({}, cache)

    await engine.browse('https://httpbin.org/html')
    const cached = await engine.browse('https://httpbin.org/html')
    assert.equal(cached.cached, true)

    cache.close()
    const fs = require('fs')
    try { fs.unlinkSync('./test/test-browse-cache.db') } catch {}
  })

  it('should return HTML when requested', async () => {
    engine = new BrowseEngine({})
    const result = await engine.browse('https://httpbin.org/html', { html: true })
    
    assert.ok(result.html)
    assert.ok(result.html.includes('<html'))
  })

  it('should expose getPage for direct automation', async () => {
    engine = new BrowseEngine({})
    const { page, context } = await engine.getPage({ url: 'https://httpbin.org/html' })
    
    assert.ok(page)
    const title = await page.title()
    assert.ok(typeof title === 'string')
    
    await page.close()
    await context.close()
  })
})

describe('CamoufoxClient', () => {
  const { CamoufoxClient } = require('../src/browse/camoufox')

  it('should initialize with defaults', () => {
    const client = new CamoufoxClient()
    assert.equal(client.baseUrl, 'http://localhost:9869')
  })

  it('should initialize with custom URL', () => {
    const client = new CamoufoxClient({ url: 'http://localhost:1234' })
    assert.equal(client.baseUrl, 'http://localhost:1234')
  })

  it('should report health', async () => {
    const client = new CamoufoxClient()
    const health = await client.health()
    // May or may not be running — just check shape
    assert.ok(typeof health.available === 'boolean')
  })
})

describe('install-stealth', () => {
  const { isInstalled, getCamoufoxPath, INSTALL_DIR } = require('../src/browse/install-stealth')

  it('should report installation status', () => {
    const installed = isInstalled()
    assert.ok(typeof installed === 'boolean')
  })

  it('should return path or null', () => {
    const p = getCamoufoxPath()
    assert.ok(p === null || typeof p === 'string')
  })

  it('should have a valid install directory', () => {
    assert.ok(INSTALL_DIR.includes('.spectrawl'))
  })
})
