const https = require('https')

/**
 * LinkedIn platform adapter.
 * Uses Cookie API — LinkedIn has aggressive bot detection.
 * OAuth available but requires LinkedIn app approval (hard to get).
 */
class LinkedInAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      default:
        throw new Error(`Unsupported LinkedIn action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { text, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for LinkedIn/${account}. Run: spectrawl login linkedin --account ${account}`)
    }

    const csrfToken = _cookies.find(c => c.name === 'JSESSIONID')?.value?.replace(/"/g, '')
    if (!csrfToken) throw new Error('Missing JSESSIONID in LinkedIn cookies')

    const cookieStr = _cookies.map(c => `${c.name}=${c.value}`).join('; ')

    // Get member URN first
    const me = await fetchJson('https://www.linkedin.com/voyager/api/me', {
      'Cookie': cookieStr,
      'Csrf-Token': csrfToken
    })

    const memberUrn = me.miniProfile?.entityUrn || me.entityUrn
    if (!memberUrn) throw new Error('Could not get LinkedIn member URN')

    // Create post via Voyager API
    const body = JSON.stringify({
      visibleToConnectionsOnly: false,
      externalAudienceProviders: [],
      commentaryV2: { text, attributes: [] },
      origin: 'FEED',
      allowedCommentersScope: 'ALL',
      media: []
    })

    const data = await postJson(
      'https://www.linkedin.com/voyager/api/contentcreation/normalizedContent',
      body,
      {
        'Cookie': cookieStr,
        'Csrf-Token': csrfToken,
        'Content-Type': 'application/json',
        'X-Li-Lang': 'en_US',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    )

    return { postId: data.urn || data.value?.urn, url: null }
  }
}

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { ...headers, 'User-Agent': 'Mozilla/5.0' }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid LinkedIn response')) }
      })
    }).on('error', reject)
  })
}

function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid LinkedIn response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = { LinkedInAdapter }
