const https = require('https')

/**
 * Discord platform adapter.
 * Uses Discord Bot API or webhooks.
 * Bot token for full access, webhooks for simple posting.
 */
class DiscordAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'send':
        return this._sendMessage(params, ctx)
      case 'webhook':
        return this._webhook(params, ctx)
      case 'create-thread':
        return this._createThread(params, ctx)
      default:
        throw new Error(`Unsupported Discord action: ${action}`)
    }
  }

  async _sendMessage(params, ctx) {
    const { channelId, content, embeds, account } = params
    const token = this._getToken(account, ctx)

    const body = { content: content || '' }
    if (embeds) body.embeds = embeds

    const data = await discordApi('POST', `/channels/${channelId}/messages`, body, token)
    return { messageId: data.id, channelId: data.channel_id }
  }

  async _webhook(params, ctx) {
    const { webhookUrl, content, username, avatarUrl, embeds } = params
    if (!webhookUrl) throw new Error('Discord webhook URL required')

    const body = { content: content || '' }
    if (username) body.username = username
    if (avatarUrl) body.avatar_url = avatarUrl
    if (embeds) body.embeds = embeds

    const urlObj = new URL(webhookUrl)
    const data = await new Promise((resolve, reject) => {
      const json = JSON.stringify(body)
      const opts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(json)
        }
      }
      const req = https.request(opts, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          if (res.statusCode === 204) return resolve({ sent: true })
          try { resolve(JSON.parse(data)) }
          catch (e) { resolve({ sent: res.statusCode < 300 }) }
        })
      })
      req.on('error', reject)
      req.write(json)
      req.end()
    })

    return { sent: true, ...data }
  }

  async _createThread(params, ctx) {
    const { channelId, name, content, account } = params
    const token = this._getToken(account, ctx)

    const thread = await discordApi('POST', `/channels/${channelId}/threads`, {
      name,
      type: 11, // PUBLIC_THREAD
      auto_archive_duration: 1440
    }, token)

    if (content) {
      await discordApi('POST', `/channels/${thread.id}/messages`, { content }, token)
    }

    return { threadId: thread.id, name: thread.name }
  }

  _getToken(account, ctx) {
    if (account?.botToken) return `Bot ${account.botToken}`
    const token = ctx?.config?.accounts?.discord?.botToken ||
                  process.env.DISCORD_BOT_TOKEN
    if (!token) throw new Error('Discord bot token required')
    return `Bot ${token}`
  }
}

function discordApi(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body)
    const opts = {
      hostname: 'discord.com',
      path: `/api/v10${path}`,
      method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
        'User-Agent': 'Spectrawl/0.1.0'
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          if (res.statusCode >= 400) {
            reject(new Error(`Discord API ${res.statusCode}: ${parsed.message || data.slice(0, 200)}`))
          } else { resolve(parsed) }
        } catch (e) { reject(new Error(`Invalid Discord response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Discord API timeout')) })
    req.write(json)
    req.end()
  })
}

module.exports = { DiscordAdapter }
