/**
 * Spectrawl Extract Engine
 * Structured data extraction from web pages using LLM + optional CSS/XPath selectors.
 * Inspired by Stagehand's extract() but self-hosted and integrated with Spectrawl's browse engine.
 */

const https = require('https')
const http = require('http')

const DEFAULT_OPTS = {
  model: 'gemini-2.0-flash',
  timeout: 30000,
  selector: null,        // CSS or XPath selector to narrow extraction scope
  instruction: null,     // natural language instruction
  schema: null,          // JSON Schema for structured output
  relevanceFilter: false // BM25-style relevance filtering
}

class ExtractEngine {
  constructor(browseEngine, config = {}) {
    this.browseEngine = browseEngine
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY
    this.openaiKey = config.openaiKey || process.env.OPENAI_API_KEY
    this.model = config.model || DEFAULT_OPTS.model
  }

  /**
   * Extract structured data from a URL.
   * @param {string} url - URL to extract from
   * @param {object} opts - extraction options
   * @param {string} opts.instruction - what to extract (natural language)
   * @param {object} opts.schema - JSON Schema for the output structure
   * @param {string} opts.selector - CSS/XPath selector to narrow scope
   * @param {boolean} opts.relevanceFilter - filter content by relevance to instruction
   * @param {string} opts.model - LLM model to use
   */
  async extract(url, opts = {}) {
    const config = { ...DEFAULT_OPTS, ...opts }
    const startTime = Date.now()

    // Step 1: Browse the page
    const page = await this.browseEngine.browse(url, {
      html: !!config.selector, // need HTML for selector extraction
      timeout: config.timeout
    })

    let content = page.content || ''

    // Step 2: If selector provided, narrow the content
    if (config.selector && page.html) {
      content = this._extractBySelector(page.html, config.selector)
      if (!content || content.length < 10) {
        content = page.content // fallback to full content
      }
    }

    // Step 3: If relevance filter, apply BM25-style filtering
    if (config.relevanceFilter && config.instruction) {
      content = this._filterByRelevance(content, config.instruction)
    }

    // Step 4: Extract with LLM
    const extracted = await this._llmExtract(content, config.instruction, config.schema)

    return {
      data: extracted,
      url: page.url,
      title: page.title,
      contentLength: content.length,
      duration: Date.now() - startTime
    }
  }

  /**
   * Extract from already-fetched content (no browsing needed).
   */
  async extractFromContent(content, opts = {}) {
    const config = { ...DEFAULT_OPTS, ...opts }

    if (config.relevanceFilter && config.instruction) {
      content = this._filterByRelevance(content, config.instruction)
    }

    const extracted = await this._llmExtract(content, config.instruction, config.schema)
    return { data: extracted }
  }

  /**
   * Extract content matching a CSS or XPath selector from HTML.
   */
  _extractBySelector(html, selector) {
    // Simple CSS selector extraction (handles common cases)
    // For XPath, we prefix with xpath=
    if (selector.startsWith('xpath=') || selector.startsWith('//')) {
      // XPath — extract using regex patterns for common XPath expressions
      const xpath = selector.replace('xpath=', '')
      return this._extractByXPath(html, xpath)
    }

    // CSS selector — use tag/class/id matching
    return this._extractByCSS(html, selector)
  }

  _extractByCSS(html, selector) {
    // Handle common CSS selectors: tag, .class, #id, tag.class, tag#id
    let pattern

    if (selector.startsWith('#')) {
      // ID selector
      const id = selector.slice(1)
      pattern = new RegExp(`<[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?(?=<\\/[^>]+>\\s*$)`, 'i')
    } else if (selector.startsWith('.')) {
      // Class selector
      const cls = selector.slice(1)
      pattern = new RegExp(`<[^>]+class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/`, 'i')
    } else {
      // Tag selector (with optional class/id)
      const parts = selector.split(/([.#])/)
      const tag = parts[0] || 'div'
      pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    }

    const matches = html.match(pattern)
    if (!matches) return null

    // Strip HTML tags and return text
    const { extractMarkdown } = require('./search/scraper')
    return extractMarkdown(matches.join('\n'))
  }

  _extractByXPath(html, xpath) {
    // Handle common XPath patterns by converting to regex
    // //table → find all <table>...</table>
    // //div[@class="content"] → find div with class content
    const tagMatch = xpath.match(/\/\/(\w+)(?:\[@(\w+)=["']([^"']+)["']\])?/)
    if (!tagMatch) return null

    const [, tag, attr, val] = tagMatch
    let pattern
    if (attr && val) {
      pattern = new RegExp(`<${tag}[^>]*${attr}=["'][^"']*${val}[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    } else {
      pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi')
    }

    const matches = html.match(pattern)
    if (!matches) return null

    const { extractMarkdown } = require('./search/scraper')
    return extractMarkdown(matches.join('\n'))
  }

  /**
   * BM25-inspired relevance filtering.
   * Splits content into sections, scores each against the query, returns top sections.
   */
  _filterByRelevance(content, query, topK = 5) {
    const queryTerms = this._tokenize(query)
    if (queryTerms.length === 0) return content

    // Split content into sections (by headings, double newlines, or paragraphs)
    const sections = content.split(/\n(?=#{1,6}\s)|(?:\n\n)/).filter(s => s.trim().length > 20)
    if (sections.length <= topK) return content

    // Calculate document frequency for IDF
    const df = {}
    for (const section of sections) {
      const terms = new Set(this._tokenize(section))
      for (const term of terms) {
        df[term] = (df[term] || 0) + 1
      }
    }

    // Score each section
    const scored = sections.map(section => {
      const sectionTerms = this._tokenize(section)
      const tf = {}
      for (const term of sectionTerms) {
        tf[term] = (tf[term] || 0) + 1
      }

      let score = 0
      for (const queryTerm of queryTerms) {
        const termFreq = tf[queryTerm] || 0
        const docFreq = df[queryTerm] || 1
        const idf = Math.log((sections.length - docFreq + 0.5) / (docFreq + 0.5) + 1)
        // BM25 formula
        const k1 = 1.2
        const b = 0.75
        const avgDl = sections.reduce((a, s) => a + this._tokenize(s).length, 0) / sections.length
        const dl = sectionTerms.length
        score += idf * ((termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * dl / avgDl)))
      }
      return { section, score }
    })

    // Return top sections in original order
    scored.sort((a, b) => b.score - a.score)
    const topSections = new Set(scored.slice(0, topK).map(s => s.section))
    return sections.filter(s => topSections.has(s)).join('\n\n')
  }

  _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  }

  /**
   * Use LLM to extract structured data from content.
   */
  async _llmExtract(content, instruction, schema) {
    // Truncate content to avoid token limits
    const maxChars = 30000
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + '\n...(truncated)'
    }

    const systemPrompt = `You are a data extraction assistant. Extract structured data from the provided web page content.
${schema ? `Return a valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}` : 'Return the extracted data as a JSON object.'}
Only return valid JSON. No markdown code fences. No explanation.`

    const userPrompt = instruction
      ? `${instruction}\n\nPage content:\n${content}`
      : `Extract the key information from this page:\n${content}`

    // Try Gemini first (free), fallback to OpenAI
    if (this.apiKey) {
      return this._geminiExtract(systemPrompt, userPrompt)
    } else if (this.openaiKey) {
      return this._openaiExtract(systemPrompt, userPrompt)
    } else {
      throw new Error('No LLM API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY.')
    }
  }

  async _geminiExtract(systemPrompt, userPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`
    
    const body = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    }

    const response = await this._post(url, body)
    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Empty response from Gemini')

    try {
      return JSON.parse(text)
    } catch (e) {
      // Try to extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
      if (jsonMatch) return JSON.parse(jsonMatch[0])
      throw new Error(`Failed to parse extraction result: ${text.slice(0, 200)}`)
    }
  }

  async _openaiExtract(systemPrompt, userPrompt) {
    const url = 'https://api.openai.com/v1/chat/completions'
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    }

    const response = await this._post(url, body, {
      'Authorization': `Bearer ${this.openaiKey}`
    })
    const text = response?.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response from OpenAI')
    return JSON.parse(text)
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
          catch (e) { reject(new Error(`Invalid JSON response: ${responseData.slice(0, 200)}`)) }
        })
      })
      req.on('error', reject)
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('LLM request timeout')) })
      req.write(data)
      req.end()
    })
  }
}

module.exports = { ExtractEngine }
