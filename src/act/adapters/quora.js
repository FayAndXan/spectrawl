/**
 * Quora platform adapter.
 * No public API — requires browser automation.
 * Uses Spectrawl's browse engine for stealth interaction.
 */
class QuoraAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'answer':
        return this._answer(params, ctx)
      case 'question':
        return this._askQuestion(params, ctx)
      default:
        throw new Error(`Unsupported Quora action: ${action}. Requires browser automation.`)
    }
  }

  async _answer(params, ctx) {
    const { questionUrl, text, _cookies, _browse } = params
    if (!_browse) throw new Error('Quora requires browse engine. Pass _browse: spectrawl.browse')

    const page = await _browse(questionUrl, {
      cookies: _cookies,
      getPage: true
    })

    const playwright = page._page
    if (!playwright) throw new Error('Quora adapter requires getPage access')

    // Click answer button
    await playwright.click('[class*="AnswerButton"], button:has-text("Answer")')
    await playwright.waitForTimeout(1000)

    // Find the contenteditable answer box
    const editor = await playwright.$('[class*="editor"], [contenteditable="true"], .q-box [role="textbox"]')
    if (!editor) throw new Error('Could not find Quora answer editor')

    // Type the answer
    await editor.click()
    await playwright.keyboard.type(text, { delay: 30 })
    await playwright.waitForTimeout(500)

    // Submit
    await playwright.click('button:has-text("Submit"), button:has-text("Post")')
    await playwright.waitForTimeout(2000)

    return { answered: true, questionUrl }
  }

  async _askQuestion(params, ctx) {
    const { question, details, topics, _cookies, _browse } = params
    if (!_browse) throw new Error('Quora requires browse engine')

    const page = await _browse('https://www.quora.com/', {
      cookies: _cookies,
      getPage: true
    })

    const playwright = page._page
    if (!playwright) throw new Error('Quora adapter requires getPage access')

    // Click "Add question" button
    await playwright.click('button:has-text("Add question"), [class*="AddQuestion"]')
    await playwright.waitForTimeout(1000)

    // Type question in the modal
    const input = await playwright.$('[placeholder*="question"], [class*="QuestionInput"] input, textarea')
    if (!input) throw new Error('Could not find question input')
    await input.type(question, { delay: 30 })

    // Add details if provided
    if (details) {
      const detailInput = await playwright.$('[placeholder*="details"], [class*="details"] [contenteditable]')
      if (detailInput) {
        await detailInput.click()
        await playwright.keyboard.type(details, { delay: 20 })
      }
    }

    // Submit
    await playwright.click('button:has-text("Add question"), button:has-text("Submit")')
    await playwright.waitForTimeout(2000)

    return { asked: true, question }
  }
}

module.exports = { QuoraAdapter }
