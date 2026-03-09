const https = require('https')

/**
 * Reddit platform adapter.
 * Method: Cookie API via OAuth endpoint.
 * Key insight: Reddit blocks datacenter IPs on web frontend
 * but NOT on oauth.reddit.com API.
 */
class RedditAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      case 'comment':
        return this._comment(params, ctx)
      case 'delete':
        return this._delete(params, ctx)
      default:
        throw new Error(`Unsupported Reddit action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { account, subreddit, title, body: text, url: linkUrl, _cookies } = params
    
    const token = await this._getToken(_cookies)
    
    const formData = new URLSearchParams()
    formData.append('sr', subreddit)
    formData.append('title', title)
    formData.append('api_type', 'json')
    
    if (linkUrl) {
      formData.append('kind', 'link')
      formData.append('url', linkUrl)
    } else {
      formData.append('kind', 'self')
      formData.append('text', text || '')
    }

    const data = await postOAuth('https://oauth.reddit.com/api/submit', formData.toString(), token)
    
    if (data.json?.errors?.length > 0) {
      throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`)
    }

    const postUrl = data.json?.data?.url
    const postId = data.json?.data?.name
    return { postId, url: postUrl }
  }

  async _comment(params, ctx) {
    const { postId, text, _cookies } = params
    
    const token = await this._getToken(_cookies)
    
    const formData = new URLSearchParams()
    formData.append('thing_id', postId)
    formData.append('text', text)
    formData.append('api_type', 'json')

    const data = await postOAuth('https://oauth.reddit.com/api/comment', formData.toString(), token)
    
    if (data.json?.errors?.length > 0) {
      throw new Error(`Reddit error: ${JSON.stringify(data.json.errors)}`)
    }

    const commentId = data.json?.data?.things?.[0]?.data?.name
    return { commentId }
  }

  async _delete(params, ctx) {
    const { thingId, _cookies } = params
    
    const token = await this._getToken(_cookies)
    
    const formData = new URLSearchParams()
    formData.append('id', thingId)

    await postOAuth('https://oauth.reddit.com/api/del', formData.toString(), token)
    return { deleted: thingId }
  }

  /**
   * Extract Bearer token from Reddit cookies.
   * Flow: cookies → hit reddit.com → get token_v2 JWT → use as Bearer
   */
  async _getToken(cookies) {
    if (!cookies) throw new Error('No Reddit cookies available')
    
    // Look for token_v2 in cookies
    const tokenCookie = cookies.find(c => c.name === 'token_v2')
    if (tokenCookie) return tokenCookie.value

    // Look for reddit_session
    const sessionCookie = cookies.find(c => c.name === 'reddit_session')
    if (sessionCookie) {
      // Need to exchange session cookie for token
      // Hit reddit.com with cookies to get fresh token_v2
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      const html = await fetchWithCookies('https://www.reddit.com/', cookieStr)
      
      // Extract access token from page
      const tokenMatch = html.match(/"accessToken":"([^"]+)"/)
      if (tokenMatch) return tokenMatch[1]
    }

    throw new Error('Could not extract Reddit auth token from cookies')
  }
}

function postOAuth(url, body, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Spectrawl/0.1.0',
        'Content-Length': Buffer.byteLength(body)
      }
    }

    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid Reddit response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Reddit API timeout')) })
    req.write(body)
    req.end()
  })
}

function fetchWithCookies(url, cookieStr) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

module.exports = { RedditAdapter }
