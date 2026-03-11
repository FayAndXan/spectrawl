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

    // Threads OAuth callback
    if (req.method === 'GET' && path === '/auth/callback/threads') {
      const code = url.searchParams.get('code')
      const errParam = url.searchParams.get('error')
      if (errParam) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end(`<h2>❌ Auth error: ${errParam}</h2>`)
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        return res.end('<h2>❌ No code received</h2>')
      }
      try {
        // Exchange code for token
        const fetch = require('node:https')
        const params = new URLSearchParams({
          client_id: '1574846783732558',
          client_secret: 'f8589ca3523b0ea5bab3fac2c2ae4c15',
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://gateway.xanos.org/auth/callback/threads'
        })
        const tokenRes = await new Promise((resolve, reject) => {
          const postData = params.toString()
          const options = {
            hostname: 'graph.threads.net',
            path: '/oauth/access_token',
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData)
            }
          }
          const req2 = fetch.request(options, (r) => {
            let data = ''
            r.on('data', chunk => data += chunk)
            r.on('end', () => resolve(JSON.parse(data)))
          })
          req2.on('error', reject)
          req2.write(postData)
          req2.end()
        })
        // Save to credentials
        const fs = require('fs')
        const credsPath = '/root/.openclaw/workspace-dijiclaw/.openclaw/credentials/threads-api.json'
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
        creds.user_token = tokenRes.access_token
        creds.user_id = tokenRes.user_id
        creds.token_type = tokenRes.token_type
        creds.note = 'User token saved via OAuth callback'
        fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        return res.end('<h2>✅ Threads connected! You can close this tab.</h2>')
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html' })
        return res.end(`<h2>❌ Token exchange failed: ${e.message}</h2>`)
      }
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
