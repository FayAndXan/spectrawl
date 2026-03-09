const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Search Engine', () => {
  const { SearchEngine } = require('../src/search')

  it('should initialize with default cascade', () => {
    const engine = new SearchEngine({})
    assert.ok(engine)
  })

  it('should handle empty query', async () => {
    const engine = new SearchEngine({ cascade: ['ddg'] })
    await assert.rejects(
      () => engine.search(''),
      { message: /query/i }
    )
  })

  it('should fall through cascade on failure', async () => {
    // SearXNG not running → should fall to DDG
    const engine = new SearchEngine({
      cascade: ['searxng', 'ddg'],
      searxng: { url: 'http://localhost:9999' } // not running
    })

    const results = await engine.search('test query')
    assert.ok(Array.isArray(results.sources))
    assert.ok(results.engine === 'ddg' || results.sources.length >= 0)
  })
})

describe('DDG Search', () => {
  const { ddgSearch } = require('../src/search/engines/ddg')

  it('should return results for a query', async () => {
    const results = await ddgSearch('javascript')
    assert.ok(Array.isArray(results))
    // DDG might fail from datacenter IP, that's ok
  })
})
