/**
 * SaaSHub platform adapter.
 * Browser automation — no public API.
 * Good for alternative comparisons and SEO.
 */
class SaaSHubAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      default:
        throw new Error(`Unsupported SaaSHub action: ${action}`)
    }
  }

  async _submit(params, ctx) {
    const { name, url, description, category, alternatives, _cookies, _browse } = params
    if (!_browse) throw new Error('SaaSHub requires browse engine')

    const page = await _browse('https://www.saashub.com/submit', {
      cookies: _cookies,
      getPage: true
    })

    const pw = page._page
    if (!pw) throw new Error('SaaSHub requires getPage access')

    await pw.waitForSelector('input[name="name"], #product_name', { timeout: 10000 })

    const nameInput = await pw.$('input[name="name"], #product_name')
    if (nameInput) await nameInput.fill(name)

    const urlInput = await pw.$('input[name="url"], input[name="website"]')
    if (urlInput) await urlInput.fill(url)

    const descInput = await pw.$('textarea[name="description"]')
    if (descInput) await descInput.fill(description || '')

    await pw.click('button[type="submit"], input[type="submit"]')
    await pw.waitForTimeout(3000)

    return { submitted: true, name, url }
  }
}

module.exports = { SaaSHubAdapter }
