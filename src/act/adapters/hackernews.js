const https = require('https')
const http = require('http')

/**
 * Hacker News platform adapter.
 * HN has no official write API — uses Firebase API for reading
 * and browser automation / cookie-based form submission for posting.
 * 
 * Read: Firebase API (no auth needed)
 * Write: Cookie-based form POST to news.ycombinator.com
 */
class HackerNewsAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      case 'comment':
        return this._comment(params, ctx)
      case 'upvote':
        return this._upvote(params, ctx)
      default:
        throw new Error(`Unsupported HN action: ${action}`)
    }
  }

  /**
   * Submit a story to HN.
   * Requires login cookie (user session).
   */
  async _submit(params, ctx) {
    const { title, url, text, _cookies } = params
    const cookie = this._getCookie(_cookies)

    // Get FNID (form nonce) from submit page
    const submitPage = await fetchHN('/submit', cookie)
    const fnidMatch = submitPage.match(/name="fnid" value="([^"]+)"/)
    if (!fnidMatch) throw new Error('Could not get HN submit form token. Check cookie validity.')
    const fnid = fnidMatch[1]

    // Submit the form
    const form = new URLSearchParams()
    form.append('fnid', fnid)
    form.append('fnop', 'submit-page')
    form.append('title', title)
    if (url) form.append('url', url)
    if (text && !url) form.append('text', text)

    const result = await postHN('/r', form.toString(), cookie)

    // HN redirects to /newest on success
    if (result.includes('newest') || result.includes('item?id=')) {
      const idMatch = result.match(/item\?id=(\d+)/)
      return {
        url: idMatch ? `https://news.ycombinator.com/item?id=${idMatch[1]}` : 'https://news.ycombinator.com/newest',
        submitted: true
      }
    }

    // Check for rate limit or error
    if (result.includes('submitting too fast')) {
      throw new Error('HN rate limit: submitting too fast')
    }

    return { submitted: true, url: 'https://news.ycombinator.com/newest' }
  }

  async _comment(params, ctx) {
    const { parentId, text, _cookies } = params
    const cookie = this._getCookie(_cookies)

    // Get the item page to find comment form HMAC
    const itemPage = await fetchHN(`/item?id=${parentId}`, cookie)
    const hmacMatch = itemPage.match(/name="hmac" value="([^"]+)"/)
    if (!hmacMatch) throw new Error('Could not get HN comment form token')

    const form = new URLSearchParams()
    form.append('parent', parentId)
    form.append('goto', `item?id=${parentId}`)
    form.append('hmac', hmacMatch[1])
    form.append('text', text)

    await postHN('/comment', form.toString(), cookie)
    return { commented: true, parentId }
  }

  async _upvote(params, ctx) {
    const { itemId, _cookies } = params
    const cookie = this._getCookie(_cookies)

    // Get vote link from item page
    const itemPage = await fetchHN(`/item?id=${itemId}`, cookie)
    const voteMatch = itemPage.match(/id="up_(\d+)"[^>]*href="([^"]+)"/)
    if (!voteMatch) throw new Error('Could not find upvote link (already voted or not logged in)')

    await fetchHN(voteMatch[2], cookie)
    return { upvoted: true, itemId }
  }

  _getCookie(cookies) {
    if (!cookies) throw new Error('HN cookies required for posting')
    if (typeof cookies === 'string') return cookies
    
    const userCookie = cookies.find(c => c.name === 'user')
    if (!userCookie) throw new Error('HN user cookie not found')
    return `user=${userCookie.value}`
  }
}

function fetchHN(path, cookie) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'news.ycombinator.com',
      path,
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, res => {
      // Follow redirects
      if (res.statusCode === 302 || res.statusCode === 301) {
        const loc = res.headers.location
        if (loc) return fetchHN(loc.startsWith('http') ? new URL(loc).pathname + new URL(loc).search : loc, cookie).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

function postHN(path, body, cookie) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'news.ycombinator.com',
      path,
      method: 'POST',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      // Follow redirect and capture location
      if (res.statusCode === 302 || res.statusCode === 301) {
        data = res.headers.location || ''
      }
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('HN timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { HackerNewsAdapter }
