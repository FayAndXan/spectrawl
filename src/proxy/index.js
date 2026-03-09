const http = require('http')
const net = require('net')
const { URL } = require('url')

/**
 * Spectrawl Proxy Server — rotating residential proxy gateway.
 * 
 * One local endpoint (localhost:8080) that rotates through upstream
 * residential proxies. Any tool on the server points here instead
 * of configuring ProxyCheap/BrightData individually.
 * 
 * Supports HTTP and HTTPS (CONNECT tunnel).
 */
class ProxyServer {
  constructor(config = {}) {
    this.port = config.port || 8080
    this.upstreams = (config.upstreams || []).map(u => ({
      ...u,
      failures: 0,
      lastFailure: 0,
      requests: 0
    }))
    this.strategy = config.strategy || 'round-robin' // round-robin | random | least-used
    this.maxFailures = config.maxFailures || 5
    this.failureCooldown = config.failureCooldown || 60000 // 1 min
    this.server = null
    this._index = 0
    this._stats = { total: 0, success: 0, failed: 0, started: null }
  }

  /**
   * Pick next upstream proxy.
   */
  _nextUpstream() {
    const now = Date.now()
    const healthy = this.upstreams.filter(u =>
      u.failures < this.maxFailures || (now - u.lastFailure) > this.failureCooldown
    )

    if (healthy.length === 0) {
      // Reset all if everything is dead
      this.upstreams.forEach(u => { u.failures = 0 })
      return this.upstreams[0] || null
    }

    switch (this.strategy) {
      case 'random':
        return healthy[Math.floor(Math.random() * healthy.length)]

      case 'least-used':
        return healthy.sort((a, b) => a.requests - b.requests)[0]

      case 'round-robin':
      default:
        this._index = (this._index + 1) % healthy.length
        return healthy[this._index]
    }
  }

  /**
   * Parse upstream proxy URL into components.
   */
  _parseUpstream(upstream) {
    if (!upstream) return null
    const url = upstream.url || `http://${upstream.host}:${upstream.port}`
    const parsed = new URL(url)
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 80,
      auth: upstream.username && upstream.password
        ? Buffer.from(`${upstream.username}:${upstream.password}`).toString('base64')
        : parsed.username && parsed.password
          ? Buffer.from(`${parsed.username}:${parsed.password}`).toString('base64')
          : null
    }
  }

  /**
   * Handle HTTP requests (non-CONNECT).
   */
  _handleRequest(clientReq, clientRes) {
    this._stats.total++
    const upstream = this._nextUpstream()

    if (!upstream) {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' })
      clientRes.end(JSON.stringify({ error: 'No upstream proxies configured' }))
      return
    }

    upstream.requests++
    const proxy = this._parseUpstream(upstream)

    const opts = {
      hostname: proxy.host,
      port: proxy.port,
      path: clientReq.url,
      method: clientReq.method,
      headers: { ...clientReq.headers }
    }

    if (proxy.auth) {
      opts.headers['Proxy-Authorization'] = `Basic ${proxy.auth}`
    }

    const proxyReq = http.request(opts, (proxyRes) => {
      this._stats.success++
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(clientRes)
    })

    proxyReq.on('error', (err) => {
      this._stats.failed++
      upstream.failures++
      upstream.lastFailure = Date.now()
      console.log(`Proxy upstream ${upstream.url || upstream.host} failed: ${err.message}`)
      clientRes.writeHead(502, { 'Content-Type': 'application/json' })
      clientRes.end(JSON.stringify({ error: 'Upstream proxy failed', detail: err.message }))
    })

    clientReq.pipe(proxyReq)
  }

  /**
   * Handle HTTPS CONNECT tunnels.
   */
  _handleConnect(clientReq, clientSocket, head) {
    this._stats.total++
    const upstream = this._nextUpstream()

    if (!upstream) {
      clientSocket.write('HTTP/1.1 502 No upstream proxy\r\n\r\n')
      clientSocket.destroy()
      return
    }

    upstream.requests++
    const proxy = this._parseUpstream(upstream)
    const [targetHost, targetPort] = clientReq.url.split(':')

    // Connect to upstream proxy
    const proxySocket = net.connect(proxy.port, proxy.host, () => {
      // Send CONNECT to upstream
      let connectReq = `CONNECT ${clientReq.url} HTTP/1.1\r\nHost: ${clientReq.url}\r\n`
      if (proxy.auth) {
        connectReq += `Proxy-Authorization: Basic ${proxy.auth}\r\n`
      }
      connectReq += '\r\n'

      proxySocket.write(connectReq)
    })

    proxySocket.once('data', (chunk) => {
      const response = chunk.toString()
      if (response.includes('200')) {
        this._stats.success++
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        proxySocket.write(head)
        proxySocket.pipe(clientSocket)
        clientSocket.pipe(proxySocket)
      } else {
        this._stats.failed++
        upstream.failures++
        upstream.lastFailure = Date.now()
        clientSocket.write('HTTP/1.1 502 Upstream Rejected\r\n\r\n')
        clientSocket.destroy()
        proxySocket.destroy()
      }
    })

    proxySocket.on('error', (err) => {
      this._stats.failed++
      upstream.failures++
      upstream.lastFailure = Date.now()
      clientSocket.write('HTTP/1.1 502 Upstream Error\r\n\r\n')
      clientSocket.destroy()
    })

    clientSocket.on('error', () => proxySocket.destroy())
  }

  /**
   * Start the proxy server.
   */
  start() {
    this.server = http.createServer((req, res) => {
      // Health endpoint
      if (req.url === '/__health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(this.stats()))
        return
      }
      this._handleRequest(req, res)
    })

    this.server.on('connect', (req, socket, head) => {
      this._handleConnect(req, socket, head)
    })

    this.server.listen(this.port, () => {
      this._stats.started = new Date().toISOString()
      console.log(`🔀 Spectrawl proxy running on http://localhost:${this.port}`)
      console.log(`   Upstreams: ${this.upstreams.length}`)
      console.log(`   Strategy: ${this.strategy}`)
      console.log(`   Health: http://localhost:${this.port}/__health`)
    })

    return this.server
  }

  /**
   * Get proxy stats.
   */
  stats() {
    return {
      ...this._stats,
      upstreams: this.upstreams.map(u => ({
        url: u.url || `${u.host}:${u.port}`,
        requests: u.requests,
        failures: u.failures,
        healthy: u.failures < this.maxFailures
      }))
    }
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}

module.exports = { ProxyServer }
