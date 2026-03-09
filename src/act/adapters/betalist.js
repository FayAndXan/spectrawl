const https = require('https')

/**
 * BetaList platform adapter.
 * Uses their submission API (POST to betalist.com/api/v1/startups).
 * Requires API key from betalist.com/developers
 */
class BetaListAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      default:
        throw new Error(`Unsupported BetaList action: ${action}`)
    }
  }

  async _submit(params, ctx) {
    const { name, url, tagline, description, email, account } = params
    const token = this._getToken(account, ctx)

    const body = JSON.stringify({
      startup: {
        name,
        url,
        one_liner: tagline,
        description: description || tagline,
        email: email || ''
      }
    })

    const data = await new Promise((resolve, reject) => {
      const opts = {
        hostname: 'betalist.com',
        path: '/api/v1/startups',
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }
      const req = https.request(opts, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { resolve({ raw: data, status: res.statusCode }) }
        })
      })
      req.on('error', reject)
      req.write(body)
      req.end()
    })

    return { submitted: true, ...data }
  }

  _getToken(account, ctx) {
    if (account?.apiKey) return account.apiKey
    return ctx?.config?.accounts?.betalist?.apiKey || process.env.BETALIST_API_KEY || ''
  }
}

module.exports = { BetaListAdapter }
