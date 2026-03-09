/**
 * AlternativeTo platform adapter.
 * No public API — browser automation for submitting alternatives.
 * High SEO value: people search "[tool] alternative" constantly.
 */
class AlternativeToAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      default:
        throw new Error(`Unsupported AlternativeTo action: ${action}. Requires browser automation.`)
    }
  }

  async _submit(params, ctx) {
    const { name, url, description, category, tags, _cookies, _browse } = params
    if (!_browse) throw new Error('AlternativeTo requires browse engine')

    const page = await _browse('https://alternativeto.net/add/', {
      cookies: _cookies,
      getPage: true
    })

    const pw = page._page
    if (!pw) throw new Error('AlternativeTo requires getPage access')

    // Fill the submission form
    await pw.waitForSelector('input[name="Name"], #Name', { timeout: 10000 })

    // Name
    const nameInput = await pw.$('input[name="Name"], #Name')
    if (nameInput) { await nameInput.fill(name) }

    // URL
    const urlInput = await pw.$('input[name="Url"], input[name="url"], #Url')
    if (urlInput) { await urlInput.fill(url) }

    // Description
    const descInput = await pw.$('textarea[name="Description"], #Description')
    if (descInput) { await descInput.fill(description || '') }

    // Tags
    if (tags?.length) {
      const tagInput = await pw.$('input[name="tags"], input[placeholder*="tag"]')
      if (tagInput) {
        for (const tag of tags) {
          await tagInput.fill(tag)
          await pw.keyboard.press('Enter')
          await pw.waitForTimeout(300)
        }
      }
    }

    // Submit
    await pw.click('button[type="submit"], input[type="submit"]')
    await pw.waitForTimeout(3000)

    return { submitted: true, name, url }
  }
}

module.exports = { AlternativeToAdapter }
