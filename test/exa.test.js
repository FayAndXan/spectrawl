const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const https = require('https')
const { EventEmitter } = require('events')

const { exaSearch } = require('../src/search/engines/exa')

/**
 * Stubs https.request so tests run offline and can assert on the
 * request shape Exa actually receives.
 */
function stubHttps({ responseBody, statusCode = 200, capture = {} }) {
  const original = https.request
  https.request = (opts, cb) => {
    capture.opts = opts
    const req = new EventEmitter()
    req.setTimeout = () => {}
    req.destroy = () => {}
    req.write = body => { capture.body = body }
    req.end = () => {
      const res = new EventEmitter()
      res.statusCode = statusCode
      cb(res)
      res.emit('data', Buffer.from(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)))
      res.emit('end')
    }
    return req
  }
  return () => { https.request = original }
}

describe('Exa Search', () => {
  let restore
  const originalKey = process.env.EXA_API_KEY

  beforeEach(() => { process.env.EXA_API_KEY = 'test-key' })

  afterEach(() => {
    if (restore) restore()
    if (originalKey === undefined) delete process.env.EXA_API_KEY
    else process.env.EXA_API_KEY = originalKey
  })

  it('throws when EXA_API_KEY is not set', async () => {
    delete process.env.EXA_API_KEY
    await assert.rejects(() => exaSearch('test'), /EXA_API_KEY required/)
  })

  it('maps API response into the cascade result shape', async () => {
    const capture = {}
    restore = stubHttps({
      capture,
      responseBody: {
        results: [
          {
            url: 'https://example.com/a',
            title: 'Example A',
            highlights: ['match one', 'match two'],
            text: 'full text body'
          }
        ]
      }
    })

    const results = await exaSearch('agent frameworks')
    assert.equal(results.length, 1)
    assert.deepEqual(results[0], {
      url: 'https://example.com/a',
      title: 'Example A',
      snippet: 'match one match two',
      engine: 'exa'
    })
  })

  it('sends x-api-key and x-exa-integration headers', async () => {
    const capture = {}
    restore = stubHttps({ capture, responseBody: { results: [] } })

    await exaSearch('q')
    assert.equal(capture.opts.headers['x-api-key'], 'test-key')
    assert.equal(capture.opts.headers['x-exa-integration'], 'spectrawl')
  })

  it('defaults type=auto and includes contents with highlights + text', async () => {
    const capture = {}
    restore = stubHttps({ capture, responseBody: { results: [] } })

    await exaSearch('q')
    const sent = JSON.parse(capture.body)
    assert.equal(sent.type, 'auto')
    assert.equal(sent.query, 'q')
    assert.equal(sent.numResults, 10)
    assert.equal(sent.contents.highlights, true)
    assert.deepEqual(sent.contents.text, { maxCharacters: 1000 })
  })

  it('forwards filters (category, domains, dates, userLocation)', async () => {
    const capture = {}
    restore = stubHttps({ capture, responseBody: { results: [] } })

    await exaSearch('q', {
      type: 'neural',
      maxResults: 3,
      category: 'research paper',
      includeDomains: ['arxiv.org'],
      excludeDomains: ['reddit.com'],
      startPublishedDate: '2024-01-01T00:00:00.000Z',
      endPublishedDate: '2024-12-31T00:00:00.000Z',
      userLocation: 'US'
    })

    const sent = JSON.parse(capture.body)
    assert.equal(sent.type, 'neural')
    assert.equal(sent.numResults, 3)
    assert.equal(sent.category, 'research paper')
    assert.deepEqual(sent.includeDomains, ['arxiv.org'])
    assert.deepEqual(sent.excludeDomains, ['reddit.com'])
    assert.equal(sent.startPublishedDate, '2024-01-01T00:00:00.000Z')
    assert.equal(sent.endPublishedDate, '2024-12-31T00:00:00.000Z')
    assert.equal(sent.userLocation, 'US')
  })

  it('allows disabling contents retrieval', async () => {
    const capture = {}
    restore = stubHttps({ capture, responseBody: { results: [] } })

    await exaSearch('q', { contents: false })
    const sent = JSON.parse(capture.body)
    assert.equal(sent.contents, undefined)
  })

  it('allows custom contents object override', async () => {
    const capture = {}
    restore = stubHttps({ capture, responseBody: { results: [] } })

    await exaSearch('q', { contents: { summary: { query: 'what is this?' } } })
    const sent = JSON.parse(capture.body)
    assert.deepEqual(sent.contents, { summary: { query: 'what is this?' } })
  })

  it('falls back through snippet sources: highlights -> summary -> text', async () => {
    const capture = {}
    restore = stubHttps({
      capture,
      responseBody: {
        results: [
          { url: 'https://a', title: 'A', highlights: ['h1'] },
          { url: 'https://b', title: 'B', summary: 'summary-only' },
          { url: 'https://c', title: 'C', text: 'raw text body that should be truncated' },
          { url: 'https://d', title: 'D' }
        ]
      }
    })

    const results = await exaSearch('q')
    assert.equal(results[0].snippet, 'h1')
    assert.equal(results[1].snippet, 'summary-only')
    assert.equal(results[2].snippet, 'raw text body that should be truncated')
    assert.equal(results[3].snippet, '')
  })

  it('throws a descriptive error when the API returns a non-results payload', async () => {
    restore = stubHttps({ responseBody: { error: 'invalid api key' } })
    await assert.rejects(() => exaSearch('q'), /Exa search failed/)
  })

  it('is registered in the cascade engine registry', () => {
    const { SearchEngine } = require('../src/search')
    const engine = new SearchEngine({ cascade: ['exa'] })
    assert.ok(engine, 'SearchEngine with exa cascade should construct without throwing')
  })
})
