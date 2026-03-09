const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  port: 3900,
  search: {
    cascade: ['ddg', 'brave', 'serper'],
    scrapeTop: 3,
    llm: null // { provider, model, apiKey }
  },
  browse: {
    defaultEngine: 'playwright',
    proxy: null, // { type, host, port, username, password }
    humanlike: {
      minDelay: 500,
      maxDelay: 2000,
      scrollBehavior: true
    }
  },
  auth: {
    refreshInterval: '4h',
    cookieStore: './data/cookies.db'
  },
  cache: {
    path: './data/cache.db',
    searchTtl: 3600,      // 1 hour
    scrapeTtl: 86400,     // 24 hours
    screenshotTtl: 3600   // 1 hour
  },
  rateLimit: {
    x: { postsPerHour: 5, minDelayMs: 30000 },
    reddit: { postsPerHour: 3, minDelayMs: 600000 }
  },
  concurrency: 3
}

function loadConfig(configPath) {
  const filePath = configPath || path.join(process.cwd(), 'spectrawl.json')
  
  let userConfig = {}
  if (fs.existsSync(filePath)) {
    try {
      userConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.warn(`Warning: Could not parse ${filePath}:`, e.message)
    }
  }

  return deepMerge(DEFAULTS, userConfig)
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

module.exports = { loadConfig, DEFAULTS }
