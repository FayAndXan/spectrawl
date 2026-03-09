const http = require('http')
const { Spectrawl } = require('./index')
const { loadConfig } = require('./config')

const config = loadConfig()
const spectrawl = new Spectrawl()

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/health') {
      return json(res, { status: 'ok', version: '0.1.0' })
    }

    if (req.method === 'GET' && path === '/status') {
      const status = await spectrawl.status()
      return json(res, { accounts: status })
    }

    if (req.method === 'POST' && path === '/search') {
      const body = await readBody(req)
      const { query, summarize, scrapeTop, minResults } = body
      if (!query) return error(res, 400, 'query is required')
      
      const results = await spectrawl.search(query, { summarize, scrapeTop, minResults })
      return json(res, results)
    }

    if (req.method === 'POST' && path === '/browse') {
      const body = await readBody(req)
      const { url: targetUrl, auth, screenshot, html, stealth } = body
      if (!targetUrl) return error(res, 400, 'url is required')
      
      const result = await spectrawl.browse(targetUrl, { auth, screenshot, html, stealth })
      
      // If screenshot, return as base64
      if (result.screenshot) {
        result.screenshot = result.screenshot.toString('base64')
      }
      return json(res, result)
    }

    if (req.method === 'POST' && path === '/act') {
      const body = await readBody(req)
      const { platform, action, ...params } = body
      if (!platform || !action) return error(res, 400, 'platform and action are required')
      
      const result = await spectrawl.act(platform, action, params)
      return json(res, result)
    }

    return error(res, 404, 'Not found')
  } catch (err) {
    console.error('Server error:', err)
    return error(res, 500, err.message)
  }
})

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function error(res, status, message) {
  json(res, { error: message }, status)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch (e) { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

const port = config.port || 3900
server.listen(port, () => {
  console.log(`🌐 Spectrawl server running on http://localhost:${port}`)
  console.log(`   POST /search  — search the web`)
  console.log(`   POST /browse  — stealth browse`)
  console.log(`   POST /act     — platform actions`)
  console.log(`   GET  /status  — auth health`)
  console.log(`   GET  /health  — server health`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await spectrawl.close()
  server.close()
})

process.on('SIGINT', async () => {
  await spectrawl.close()
  server.close()
})
