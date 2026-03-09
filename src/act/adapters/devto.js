const https = require('https')

/**
 * Dev.to platform adapter.
 * Uses official REST API — simple, no cookies needed.
 */
class DevtoAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      case 'update':
        return this._update(params, ctx)
      default:
        throw new Error(`Unsupported Dev.to action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { title, body, tags, published, account } = params
    
    const apiKey = await this._getApiKey(account, ctx)
    
    const article = {
      article: {
        title,
        body_markdown: body,
        published: published !== false,
        tags: tags || []
      }
    }

    const data = await postJson('https://dev.to/api/articles', JSON.stringify(article), {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    })

    return { articleId: data.id, url: data.url, slug: data.slug }
  }

  async _update(params, ctx) {
    const { articleId, title, body, tags, published, account } = params
    
    const apiKey = await this._getApiKey(account, ctx)
    
    const article = { article: {} }
    if (title) article.article.title = title
    if (body) article.article.body_markdown = body
    if (tags) article.article.tags = tags
    if (published !== undefined) article.article.published = published

    const data = await putJson(`https://dev.to/api/articles/${articleId}`, JSON.stringify(article), {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    })

    return { articleId: data.id, url: data.url }
  }

  async _getApiKey(account, ctx) {
    // Try to get API key from auth store
    const creds = await ctx.auth.getCookies('devto', account)
    if (creds?.apiKey) return creds.apiKey
    
    // Try env
    if (process.env.DEVTO_API_KEY) return process.env.DEVTO_API_KEY
    
    throw new Error('Dev.to API key not configured. Run: spectrawl login devto --api-key YOUR_KEY')
  }
}

function postJson(url, body, headers) {
  return jsonRequest('POST', url, body, headers)
}

function putJson(url, body, headers) {
  return jsonRequest('PUT', url, body, headers)
}

function jsonRequest(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Dev.to response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = { DevtoAdapter }
