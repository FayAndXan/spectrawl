/**
 * Spectrawl Agent Engine
 * Natural language browser actions — "click the sign in button", "fill the search box with query".
 * Uses LLM to interpret page DOM and generate Playwright actions.
 */

const https = require('https')

class AgentEngine {
  constructor(browseEngine, config = {}) {
    this.browseEngine = browseEngine
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY
    this.openaiKey = config.openaiKey || process.env.OPENAI_API_KEY
    this.model = config.model || 'gemini-2.0-flash'
  }

  /**
   * Execute a natural language action on a page.
   * @param {string} url - URL to navigate to
   * @param {string} instruction - what to do (e.g. "click the login button")
   * @param {object} opts - options
   * @param {number} opts.maxSteps - max number of actions to take (default 5)
   * @param {boolean} opts.screenshot - take screenshot after action
   * @param {number} opts.timeout - timeout per action in ms
   */
  async act(url, instruction, opts = {}) {
    const maxSteps = opts.maxSteps || 5
    const timeout = opts.timeout || 30000
    const startTime = Date.now()
    const steps = []

    // Get a browser page
    const { page, context } = await this.browseEngine.getPage({ url, timeout })

    try {
      // Wait for page to be ready
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      await page.waitForTimeout(1000)

      for (let i = 0; i < maxSteps; i++) {
        // Get simplified DOM
        const dom = await this._getSimplifiedDOM(page)

        // Ask LLM what to do
        const action = await this._planAction(dom, instruction, steps, page.url())

        if (action.done) {
          steps.push({ step: i + 1, action: 'done', reason: action.reason })
          break
        }

        // Execute the action
        try {
          const result = await this._executeAction(page, action)
          steps.push({ step: i + 1, ...action, result: result || 'ok' })

          // Wait for potential navigation/load
          await page.waitForTimeout(500 + Math.random() * 1000)
          await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {})
        } catch (err) {
          steps.push({ step: i + 1, ...action, error: err.message })
          // Continue trying if there are more steps
        }
      }

      // Get final page state
      const finalContent = await page.evaluate(() => document.body?.innerText?.slice(0, 10000) || '')
      const finalUrl = page.url()
      const finalTitle = await page.title()

      let screenshot = null
      if (opts.screenshot) {
        screenshot = await page.screenshot({ type: 'png', fullPage: false })
      }

      return {
        success: steps.some(s => s.action === 'done' || !s.error),
        url: finalUrl,
        title: finalTitle,
        steps,
        content: finalContent,
        screenshot,
        duration: Date.now() - startTime
      }
    } finally {
      await context.close().catch(() => {})
    }
  }

  /**
   * Get a simplified DOM representation for the LLM.
   * Strips noise, keeps interactive elements with indices.
   */
  async _getSimplifiedDOM(page) {
    return page.evaluate(() => {
      const elements = []
      const interactiveSelectors = [
        'a[href]', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '[role="link"]', '[role="tab"]',
        '[onclick]', '[type="submit"]', 'label'
      ]

      const allElements = document.querySelectorAll(interactiveSelectors.join(','))

      allElements.forEach((el, idx) => {
        if (!el.offsetParent && el.tagName !== 'INPUT') return // skip hidden
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return

        const tag = el.tagName.toLowerCase()
        const type = el.type || ''
        const text = (el.textContent || '').trim().slice(0, 100)
        const placeholder = el.placeholder || ''
        const ariaLabel = el.getAttribute('aria-label') || ''
        const href = el.href || ''
        const value = el.value || ''
        const name = el.name || ''
        const id = el.id || ''

        // Create a unique selector for this element
        let selector = tag
        if (id) selector = `#${id}`
        else if (name) selector = `${tag}[name="${name}"]`
        else if (ariaLabel) selector = `${tag}[aria-label="${ariaLabel}"]`

        elements.push({
          idx,
          tag,
          type,
          text: text.slice(0, 80),
          placeholder,
          ariaLabel,
          href: href.slice(0, 100),
          value,
          selector,
          id,
          name
        })
      })

      return {
        title: document.title,
        url: location.href,
        elements: elements.slice(0, 100) // cap at 100 elements
      }
    })
  }

  /**
   * Ask LLM to plan the next action.
   */
  async _planAction(dom, instruction, previousSteps, currentUrl) {
    const prompt = `You are a browser automation agent. Given the current page state and instruction, determine the next action.

Current URL: ${currentUrl}
Page title: ${dom.title}

Interactive elements on page:
${dom.elements.map(e => `[${e.idx}] <${e.tag}${e.type ? ` type="${e.type}"` : ''}${e.id ? ` id="${e.id}"` : ''}${e.name ? ` name="${e.name}"` : ''}> ${e.text || e.placeholder || e.ariaLabel || e.href || '(empty)'}`).join('\n')}

Instruction: ${instruction}

Previous steps: ${previousSteps.length > 0 ? JSON.stringify(previousSteps) : 'none'}

Respond with a JSON object:
- If the instruction is complete: {"done": true, "reason": "why it's done"}
- To click: {"action": "click", "elementIdx": 5, "reason": "clicking the login button"}
- To type: {"action": "type", "elementIdx": 3, "text": "hello", "reason": "filling search box"}
- To select: {"action": "select", "elementIdx": 7, "value": "option1", "reason": "selecting dropdown"}
- To press a key: {"action": "press", "key": "Enter", "reason": "submitting form"}
- To scroll: {"action": "scroll", "direction": "down", "reason": "loading more content"}

Only return valid JSON. No explanation.`

    const result = await this._llmCall(prompt)
    return result
  }

  /**
   * Execute a planned action on the page.
   */
  async _executeAction(page, action) {
    switch (action.action) {
      case 'click': {
        const elements = await page.$$('a[href], button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [onclick], [type="submit"], label')
        const visibleElements = []
        for (const el of elements) {
          const visible = await el.isVisible().catch(() => false)
          if (visible) visibleElements.push(el)
        }
        const target = visibleElements[action.elementIdx]
        if (!target) throw new Error(`Element [${action.elementIdx}] not found`)
        await target.click({ timeout: 5000 })
        return 'clicked'
      }

      case 'type': {
        const elements = await page.$$('a[href], button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [onclick], [type="submit"], label')
        const visibleElements = []
        for (const el of elements) {
          const visible = await el.isVisible().catch(() => false)
          if (visible) visibleElements.push(el)
        }
        const target = visibleElements[action.elementIdx]
        if (!target) throw new Error(`Element [${action.elementIdx}] not found`)
        await target.fill('')
        await target.type(action.text, { delay: 50 + Math.random() * 100 })
        return 'typed'
      }

      case 'select': {
        const elements = await page.$$('a[href], button, input, textarea, select, [role="button"], [role="link"], [role="tab"], [onclick], [type="submit"], label')
        const visibleElements = []
        for (const el of elements) {
          const visible = await el.isVisible().catch(() => false)
          if (visible) visibleElements.push(el)
        }
        const target = visibleElements[action.elementIdx]
        if (!target) throw new Error(`Element [${action.elementIdx}] not found`)
        await target.selectOption(action.value)
        return 'selected'
      }

      case 'press':
        await page.keyboard.press(action.key)
        return 'pressed'

      case 'scroll':
        await page.evaluate((dir) => {
          window.scrollBy(0, dir === 'up' ? -500 : 500)
        }, action.direction)
        return 'scrolled'

      default:
        throw new Error(`Unknown action: ${action.action}`)
    }
  }

  async _llmCall(prompt) {
    if (this.apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
      }

      const response = await this._post(url, body)
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Empty LLM response')
      return JSON.parse(text)
    } else if (this.openaiKey) {
      const url = 'https://api.openai.com/v1/chat/completions'
      const body = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }
      const response = await this._post(url, body, { 'Authorization': `Bearer ${this.openaiKey}` })
      return JSON.parse(response?.choices?.[0]?.message?.content)
    }
    throw new Error('No LLM API key configured')
  }

  _post(url, body, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const data = JSON.stringify(body)
      const opts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...extraHeaders
        }
      }
      const req = https.request(opts, res => {
        let responseData = ''
        res.on('data', chunk => responseData += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(responseData)) }
          catch (e) { reject(new Error(`Invalid JSON: ${responseData.slice(0, 200)}`)) }
        })
      })
      req.on('error', reject)
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('LLM timeout')) })
      req.write(data)
      req.end()
    })
  }
}

module.exports = { AgentEngine }
