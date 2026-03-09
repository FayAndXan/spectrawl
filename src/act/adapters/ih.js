/**
 * IndieHackers platform adapter.
 * Browser-only — no API available.
 * Requires Camoufox or Playwright with stored cookies.
 */
class IHAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      case 'comment':
        return this._comment(params, ctx)
      default:
        throw new Error(`Unsupported IH action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { title, body, group, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for IH/${account}. Run: spectrawl login ih --account ${account}`)
    }

    // IH requires browser automation — no API
    const page = await ctx.browse.browse('https://www.indiehackers.com/new-post', {
      _cookies,
      extract: false
    })

    // This needs actual browser interaction
    // TODO: implement with browse engine page handle
    throw new Error('IH posting requires browser automation (coming soon). Use spectrawl browse with manual interaction for now.')
  }

  async _comment(params, ctx) {
    const { postUrl, text, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for IH/${account}. Run: spectrawl login ih --account ${account}`)
    }

    // Same as post — needs browser automation
    throw new Error('IH commenting requires browser automation (coming soon).')
  }
}

module.exports = { IHAdapter }
