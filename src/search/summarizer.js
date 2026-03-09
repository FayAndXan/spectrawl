const https = require('https')

/**
 * LLM summarization for search results.
 * Supports: openai, anthropic, minimax, ollama
 */
class Summarizer {
  constructor(config = {}) {
    this.provider = config.provider || 'openai'
    this.model = config.model || 'gpt-4o-mini'
    this.apiKey = config.apiKey || process.env[this._envKey()]
    this.baseUrl = config.baseUrl || null
  }

  _envKey() {
    const keys = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      xai: 'XAI_API_KEY',
      gemini: 'GEMINI_API_KEY'
    }
    return keys[this.provider] || 'OPENAI_API_KEY'
  }

  async summarize(query, sources) {
    if (!this.apiKey) return null

    const context = sources
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${(s.fullContent || s.snippet || '').slice(0, 1000)}`)
      .join('\n\n')

    const prompt = `Answer this question directly: "${query}"

Rules:
- Give a clear, specific answer. Name things, list tools, state facts.
- Use [1], [2] etc. to cite sources inline.
- Never say "based on the provided sources" or "according to search results."
- Never hedge with "it appears" or "it seems." Be direct.
- If sources disagree, note it briefly.
- Keep it concise — 2-4 paragraphs max.

Sources:
${context}

Answer:`

    try {
      return await this._call(prompt)
    } catch (err) {
      console.warn('Summarization failed:', err.message)
      return null
    }
  }

  async _call(prompt) {
    switch (this.provider) {
      case 'openai':
      case 'minimax':
      case 'xai':
        return this._openaiCompatible(prompt)
      case 'anthropic':
        return this._anthropic(prompt)
      case 'gemini':
        return this._gemini(prompt)
      case 'ollama':
        return this._ollama(prompt)
      default:
        return this._openaiCompatible(prompt)
    }
  }

  async _openaiCompatible(prompt) {
    const urls = {
      openai: 'https://api.openai.com/v1/chat/completions',
      minimax: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
      xai: 'https://api.x.ai/v1/chat/completions'
    }
    const url = this.baseUrl || urls[this.provider] || urls.openai

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a search engine. Give direct, specific answers with numbered citations. Never hedge or qualify with "based on sources" — just answer the question.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    })

    const data = await postJson(url, body, {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    })

    return data.choices?.[0]?.message?.content || null
  }

  async _anthropic(prompt) {
    const url = this.baseUrl || 'https://api.anthropic.com/v1/messages'
    const body = JSON.stringify({
      model: this.model || 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })

    const data = await postJson(url, body, {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    })

    return data.content?.[0]?.text || null
  }

  async _gemini(prompt) {
    const model = this.model || 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
    })

    const data = await postJson(url, body, { 'Content-Type': 'application/json' })
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  }

  async _ollama(prompt) {
    const url = this.baseUrl || 'http://localhost:11434/api/generate'
    const body = JSON.stringify({
      model: this.model || 'llama3',
      prompt,
      stream: false
    })

    const data = await postJson(url, body, {
      'Content-Type': 'application/json'
    })

    return data.response || null
  }
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : require('http')
    
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      }
    }

    const req = client.request(opts, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('LLM timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { Summarizer }
