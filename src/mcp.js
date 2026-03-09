/**
 * MCP (Model Context Protocol) server for Spectrawl.
 * Exposes search, browse, act, auth, and status as MCP tools.
 * Communicates over stdio (standard MCP transport).
 */

const { Spectrawl } = require('./index')

const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web using free API cascade (DuckDuckGo, Brave, Serper). Returns results with optional LLM summary and full page content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        summarize: { type: 'boolean', description: 'Generate LLM summary with citations', default: false },
        scrapeTop: { type: 'number', description: 'Number of top results to scrape for full content', default: 3 },
        minResults: { type: 'number', description: 'Minimum results before trying next engine', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'web_browse',
    description: 'Browse a URL with stealth anti-detection. Extracts text content, optionally takes screenshots. Supports authenticated sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to browse' },
        auth: { type: 'string', description: 'Platform name to use stored auth (e.g. "reddit", "x")' },
        screenshot: { type: 'boolean', description: 'Take a screenshot', default: false },
        html: { type: 'boolean', description: 'Return raw HTML', default: false },
        stealth: { type: 'boolean', description: 'Force stealth browser mode', default: false }
      },
      required: ['url']
    }
  },
  {
    name: 'web_act',
    description: 'Perform an authenticated action on a platform (post, comment, like, etc). Supports X/Twitter, Reddit, Dev.to.',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string', description: 'Platform name (x, reddit, devto)', enum: ['x', 'reddit', 'devto'] },
        action: { type: 'string', description: 'Action to perform (post, comment, like, delete)' },
        account: { type: 'string', description: 'Account handle (e.g. @myhandle)' },
        text: { type: 'string', description: 'Text content for post/comment' },
        title: { type: 'string', description: 'Title (for Reddit/Dev.to posts)' },
        subreddit: { type: 'string', description: 'Subreddit name (Reddit only)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags (Dev.to only)' }
      },
      required: ['platform', 'action']
    }
  },
  {
    name: 'web_auth',
    description: 'Manage platform authentication. Add, remove, or list accounts.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Auth action', enum: ['list', 'add', 'remove'] },
        platform: { type: 'string', description: 'Platform name' },
        account: { type: 'string', description: 'Account handle' }
      },
      required: ['action']
    }
  },
  {
    name: 'web_status',
    description: 'Check health status of all authenticated accounts. Shows cookie expiry, OAuth status, and issues.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

class MCPServer {
  constructor(configPath) {
    this.spectrawl = new Spectrawl(configPath)
    this._buffer = ''
  }

  async start() {
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      this._buffer += chunk
      this._processBuffer()
    })
    process.stdin.on('end', () => {
      this.spectrawl.close()
    })
  }

  _processBuffer() {
    const lines = this._buffer.split('\n')
    this._buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const msg = JSON.parse(line)
        this._handleMessage(msg)
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }

  async _handleMessage(msg) {
    if (msg.method === 'initialize') {
      this._send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'spectrawl', version: '0.1.0' }
        }
      })
    } else if (msg.method === 'tools/list') {
      this._send({
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools: TOOLS }
      })
    } else if (msg.method === 'tools/call') {
      const result = await this._handleToolCall(msg.params.name, msg.params.arguments || {})
      this._send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      })
    } else if (msg.method === 'notifications/initialized') {
      // Client acknowledged init, nothing to do
    }
  }

  async _handleToolCall(name, args) {
    try {
      switch (name) {
        case 'web_search':
          return await this.spectrawl.search(args.query, {
            summarize: args.summarize,
            scrapeTop: args.scrapeTop,
            minResults: args.minResults
          })
        case 'web_browse':
          return await this.spectrawl.browse(args.url, {
            auth: args.auth,
            screenshot: args.screenshot,
            html: args.html,
            stealth: args.stealth
          })
        case 'web_act':
          return await this.spectrawl.act(args.platform, args.action, {
            account: args.account,
            text: args.text,
            title: args.title,
            subreddit: args.subreddit,
            tags: args.tags
          })
        case 'web_auth':
          if (args.action === 'list') return await this.spectrawl.status()
          if (args.action === 'remove') {
            await this.spectrawl.auth.remove(args.platform, args.account)
            return { removed: `${args.platform}/${args.account}` }
          }
          return { error: 'Use CLI for adding accounts: spectrawl login <platform>' }
        case 'web_status':
          return await this.spectrawl.status()
        default:
          return { error: `Unknown tool: ${name}` }
      }
    } catch (err) {
      return { error: err.message }
    }
  }

  _send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\n')
  }
}

// Run if called directly
if (require.main === module) {
  const server = new MCPServer()
  server.start()
}

module.exports = { MCPServer, TOOLS }
