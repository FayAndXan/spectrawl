const { smartFill } = require('../form-filler')

/**
 * IndieHackers platform adapter.
 * Browser-only — no API available. Uses Playwright page automation.
 * 
 * IH is an Ember.js app. Key patterns:
 * - IDs are dynamic (ember48, ember49, etc.)
 * - Must use class/placeholder selectors instead
 * - New post page: /new-post (requires auth)
 * - Groups: selected via dropdown before posting
 * - Editor: contentEditable div (Ember component)
 */
class IHAdapter {
  constructor() {
    this.baseUrl = 'https://www.indiehackers.com'
    // Timeouts for various operations
    this.navTimeout = 30000
    this.actionTimeout = 10000
  }

  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      case 'comment':
        return this._comment(params, ctx)
      case 'upvote':
        return this._upvote(params, ctx)
      default:
        throw new Error(`Unsupported IH action: ${action}`)
    }
  }

  /**
   * Create a new post on IndieHackers.
   * @param {object} params - { title, body, group?, account, _cookies }
   */
  async _post(params, ctx) {
    const { title, body, group, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for IH/${account}. Run: spectrawl login ih --account ${account}`)
    }
    if (!title) throw new Error('IH post requires a title')
    if (!body) throw new Error('IH post requires a body')

    // Get a raw page from the browse engine
    const { page, context } = await ctx.browse.getPage({
      _cookies,
      url: `${this.baseUrl}/new-post`
    })

    try {
      // Check if we got redirected to sign-in (cookies expired)
      if (page.url().includes('/sign-in')) {
        throw new Error(`IH cookies expired for ${account}. Re-authenticate with: spectrawl login ih --account ${account}`)
      }

      // Wait for the post form to load
      await page.waitForTimeout(2000)

      // Select group if specified
      if (group) {
        await this._selectGroup(page, group)
      }

      // Fill title — IH uses an input with specific class
      const titleSelector = 'input[placeholder*="title" i], input[placeholder*="Title" i], .post-form__title input, input.ember-text-field[type="text"]'
      await page.waitForSelector(titleSelector, { timeout: this.actionTimeout })
      await smartFill(page, titleSelector, title)
      await page.waitForTimeout(300 + Math.random() * 500)

      // Fill body — IH uses contentEditable div for the editor
      const bodySelector = '[contenteditable="true"], .post-form__body [contenteditable], .ember-view[contenteditable], .ProseMirror, .ql-editor, textarea.ember-text-area'
      await page.waitForSelector(bodySelector, { timeout: this.actionTimeout })
      await smartFill(page, bodySelector, body)
      await page.waitForTimeout(500 + Math.random() * 1000)

      // Click submit/publish button
      const submitSelector = 'button:has-text("Publish"), button:has-text("Post"), button:has-text("Submit"), button[type="submit"]'
      await page.waitForSelector(submitSelector, { timeout: this.actionTimeout })
      
      // Human-like pause before clicking submit
      await page.waitForTimeout(1000 + Math.random() * 2000)
      await page.click(submitSelector)

      // Wait for navigation (post created → redirects to post page)
      await page.waitForTimeout(3000)

      // Verify we're on a post page
      const finalUrl = page.url()
      const postCreated = finalUrl.includes('/post/') || finalUrl.includes('/product/')

      if (!postCreated) {
        // Check for error messages
        const errorText = await page.evaluate(() => {
          const err = document.querySelector('.error, .alert, .flash-message, [class*="error"]')
          return err ? err.innerText : null
        })
        
        if (errorText) {
          throw new Error(`IH post failed: ${errorText}`)
        }

        // Might still be processing
        await page.waitForTimeout(3000)
        const retryUrl = page.url()
        if (!retryUrl.includes('/post/') && !retryUrl.includes('/product/')) {
          throw new Error(`IH post may have failed. Final URL: ${retryUrl}`)
        }
      }

      return {
        url: page.url(),
        title: await page.title(),
        platform: 'ih'
      }
    } finally {
      await page.close()
      await context.close()
    }
  }

  /**
   * Comment on an IH post.
   * @param {object} params - { postUrl, text, account, _cookies }
   */
  async _comment(params, ctx) {
    const { postUrl, text, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for IH/${account}. Run: spectrawl login ih --account ${account}`)
    }
    if (!postUrl) throw new Error('IH comment requires postUrl')
    if (!text) throw new Error('IH comment requires text')

    const { page, context } = await ctx.browse.getPage({
      _cookies,
      url: postUrl
    })

    try {
      if (page.url().includes('/sign-in')) {
        throw new Error(`IH cookies expired for ${account}. Re-authenticate.`)
      }

      await page.waitForTimeout(2000)

      // Find and click the comment input area
      const commentSelector = '[contenteditable="true"], textarea[placeholder*="comment" i], textarea[placeholder*="reply" i], .comment-form [contenteditable], .ProseMirror, .ql-editor'
      
      // Scroll to comment area first
      await page.evaluate(() => {
        const commentArea = document.querySelector('[contenteditable="true"], textarea[placeholder*="comment" i]')
        if (commentArea) commentArea.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      await page.waitForTimeout(1000)

      await page.waitForSelector(commentSelector, { timeout: this.actionTimeout })
      await smartFill(page, commentSelector, text)
      await page.waitForTimeout(500 + Math.random() * 1000)

      // Submit comment
      const submitSelector = 'button:has-text("Reply"), button:has-text("Comment"), button:has-text("Submit"), button:has-text("Post")'
      await page.click(submitSelector)
      await page.waitForTimeout(3000)

      return {
        url: postUrl,
        commented: true,
        platform: 'ih'
      }
    } finally {
      await page.close()
      await context.close()
    }
  }

  /**
   * Upvote an IH post.
   */
  async _upvote(params, ctx) {
    const { postUrl, account, _cookies } = params

    if (!_cookies) {
      throw new Error(`No auth for IH/${account}. Run: spectrawl login ih --account ${account}`)
    }

    const { page, context } = await ctx.browse.getPage({
      _cookies,
      url: postUrl
    })

    try {
      if (page.url().includes('/sign-in')) {
        throw new Error(`IH cookies expired for ${account}. Re-authenticate.`)
      }

      await page.waitForTimeout(2000)

      // Find upvote button
      const upvoteSelector = 'button[class*="upvote"], .upvote-button, [data-test*="upvote"], button:has-text("upvote")'
      await page.waitForSelector(upvoteSelector, { timeout: this.actionTimeout })
      await page.click(upvoteSelector)
      await page.waitForTimeout(1000)

      return {
        url: postUrl,
        upvoted: true,
        platform: 'ih'
      }
    } finally {
      await page.close()
      await context.close()
    }
  }

  /**
   * Select a group/community from the dropdown.
   */
  async _selectGroup(page, group) {
    // IH group selector varies — try common patterns
    const groupSelector = 'select[class*="group"], .group-selector, [data-test*="group"], button:has-text("Select a group")'
    
    try {
      await page.waitForSelector(groupSelector, { timeout: 5000 })
      
      // If it's a select element
      const isSelect = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return el?.tagName === 'SELECT'
      }, groupSelector)

      if (isSelect) {
        await page.selectOption(groupSelector, { label: group })
      } else {
        // Click to open dropdown, then find the option
        await page.click(groupSelector)
        await page.waitForTimeout(500)
        await page.click(`text="${group}"`)
      }
      
      await page.waitForTimeout(500)
    } catch (e) {
      console.log(`Could not select group "${group}": ${e.message}. Posting without group.`)
    }
  }
}

module.exports = { IHAdapter }
