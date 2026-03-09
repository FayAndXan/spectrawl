const https = require('https')

/**
 * DevHunt platform adapter.
 * Dev-focused Product Hunt alternative.
 * Uses GitHub OAuth — you log in with GitHub and submit tools.
 * Browser automation for submission.
 */
class DevHuntAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      default:
        throw new Error(`Unsupported DevHunt action: ${action}`)
    }
  }

  async _submit(params, ctx) {
    const { name, url, description, tagline, githubUrl, _cookies, _browse } = params
    if (!_browse) throw new Error('DevHunt requires browse engine')

    const page = await _browse('https://devhunt.org/submit', {
      cookies: _cookies,
      getPage: true
    })

    const pw = page._page
    if (!pw) throw new Error('DevHunt requires getPage access')

    await pw.waitForSelector('input, form', { timeout: 10000 })

    // Fill form fields
    const fields = [
      ['input[name="name"], input[placeholder*="name"]', name],
      ['input[name="url"], input[placeholder*="url"], input[placeholder*="URL"]', url],
      ['input[name="tagline"], input[placeholder*="tagline"]', tagline || description?.slice(0, 100)],
      ['textarea[name="description"], textarea[placeholder*="description"]', description],
      ['input[name="github_url"], input[placeholder*="github"]', githubUrl]
    ]

    for (const [selector, value] of fields) {
      if (!value) continue
      const el = await pw.$(selector)
      if (el) await el.fill(value)
    }

    await pw.click('button[type="submit"], input[type="submit"]')
    await pw.waitForTimeout(3000)

    return { submitted: true, name, url }
  }
}

module.exports = { DevHuntAdapter }
