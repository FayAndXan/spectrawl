const https = require('https')

/**
 * Medium platform adapter.
 * Uses Medium's REST API with integration tokens.
 * Docs: https://github.com/Medium/medium-api-docs
 */
class MediumAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      default:
        throw new Error(`Unsupported Medium action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { title, body, tags, publishStatus, account } = params
    const token = this._getToken(account, ctx)

    // Get user ID first
    const me = await apiGet('https://api.medium.com/v1/me', token)
    const userId = me.data?.id
    if (!userId) throw new Error('Could not get Medium user ID')

    const article = {
      title,
      contentFormat: 'markdown',
      content: body,
      tags: tags || [],
      publishStatus: publishStatus || 'public' // public, draft, unlisted
    }

    const data = await apiPost(
      `https://api.medium.com/v1/users/${userId}/posts`,
      JSON.stringify(article),
      token
    )

    return {
      postId: data.data?.id,
      url: data.data?.url,
      title: data.data?.title
    }
  }

  _getToken(account, ctx) {
    if (account?.apiKey) return account.apiKey
    const token = ctx?.config?.accounts?.medium?.apiKey ||
                  process.env.MEDIUM_API_KEY
    if (!token) throw new Error('Medium API key required. Get one from medium.com/me/settings')
    return token
  }
}

function apiGet(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Medium response: ${data.slice(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

function apiPost(url, body, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Medium response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Medium API timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { MediumAdapter }
