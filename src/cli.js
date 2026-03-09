#!/usr/bin/env node

const { Spectrawl } = require('./index')
const { DEFAULTS } = require('./config')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const command = args[0]

async function main() {
  switch (command) {
    case 'init':
      return init()
    case 'search':
      return search(args.slice(1).join(' '))
    case 'status':
      return status()
    case 'serve':
      return serve()
    case 'version':
      console.log('spectrawl v0.1.0')
      return
    default:
      return help()
  }
}

function init() {
  const configPath = path.join(process.cwd(), 'spectrawl.json')
  if (fs.existsSync(configPath)) {
    console.log('spectrawl.json already exists')
    return
  }

  const config = {
    port: DEFAULTS.port,
    search: {
      cascade: DEFAULTS.search.cascade,
      scrapeTop: DEFAULTS.search.scrapeTop
    },
    cache: {
      path: DEFAULTS.cache.path,
      searchTtl: DEFAULTS.cache.searchTtl,
      scrapeTtl: DEFAULTS.cache.scrapeTtl
    },
    concurrency: DEFAULTS.concurrency
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log('Created spectrawl.json')
}

async function search(query) {
  if (!query) {
    console.error('Usage: spectrawl search "your query"')
    process.exit(1)
  }

  const web = new Spectrawl()
  try {
    console.log(`Searching: "${query}"...\n`)
    const results = await web.search(query, { summarize: false })
    
    if (results.answer) {
      console.log('Answer:', results.answer, '\n')
    }

    for (const source of results.sources) {
      console.log(`  ${source.title}`)
      console.log(`  ${source.url}`)
      console.log(`  ${source.snippet?.slice(0, 150)}`)
      console.log()
    }

    console.log(`${results.sources.length} results${results.cached ? ' (cached)' : ''}`)
  } finally {
    await web.close()
  }
}

async function status() {
  const web = new Spectrawl()
  try {
    const accounts = await web.status()
    
    if (accounts.length === 0) {
      console.log('No accounts configured. Run: spectrawl login <platform> --account @handle')
      return
    }

    for (const acc of accounts) {
      const icon = acc.status === 'valid' ? '✅' :
                   acc.status === 'expiring' ? '⚠️' : '❌'
      const extra = acc.expiresAt ? ` (expires ${acc.expiresAt})` : ''
      console.log(`${icon} ${acc.platform}/${acc.account} — ${acc.status}${extra}`)
    }
  } finally {
    await web.close()
  }
}

async function serve() {
  const port = getFlag('--port') || DEFAULTS.port
  // TODO: implement HTTP + MCP server
  console.log(`Spectrawl server starting on port ${port}...`)
  console.log('HTTP + MCP server not yet implemented.')
}

function help() {
  console.log(`
🌐 Spectrawl — The unified web layer for AI agents.

Commands:
  init                     Create spectrawl.json config
  search "query"           Search the web
  status                   Check auth health for all accounts
  serve [--port N]         Start HTTP + MCP server
  version                  Show version

Examples:
  spectrawl init
  spectrawl search "best dental clinics in seoul"
  spectrawl status
  spectrawl serve --port 3900
`)
}

function getFlag(flag) {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] : null
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
