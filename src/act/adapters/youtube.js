const https = require('https')
const { URL } = require('url')

/**
 * YouTube platform adapter.
 * Uses YouTube Data API v3 for video metadata, comments, playlists.
 * Video uploads require OAuth2 + resumable upload (complex).
 * 
 * Simpler actions (comment, playlist, community post) are API-based.
 */
class YouTubeAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'comment':
        return this._comment(params, ctx)
      case 'reply':
        return this._reply(params, ctx)
      case 'create-playlist':
        return this._createPlaylist(params, ctx)
      case 'add-to-playlist':
        return this._addToPlaylist(params, ctx)
      case 'update-video':
        return this._updateVideo(params, ctx)
      default:
        throw new Error(`Unsupported YouTube action: ${action}. Supported: comment, reply, create-playlist, add-to-playlist, update-video`)
    }
  }

  async _comment(params, ctx) {
    const { videoId, text, account } = params
    const token = this._getToken(account, ctx)

    const data = await ytApi('POST', '/commentThreads?part=snippet', {
      snippet: {
        videoId,
        topLevelComment: {
          snippet: { textOriginal: text }
        }
      }
    }, token)

    return {
      commentId: data.id,
      videoId
    }
  }

  async _reply(params, ctx) {
    const { parentId, text, account } = params
    const token = this._getToken(account, ctx)

    const data = await ytApi('POST', '/comments?part=snippet', {
      snippet: {
        parentId,
        textOriginal: text
      }
    }, token)

    return { commentId: data.id }
  }

  async _createPlaylist(params, ctx) {
    const { title, description, privacyStatus, account } = params
    const token = this._getToken(account, ctx)

    const data = await ytApi('POST', '/playlists?part=snippet,status', {
      snippet: {
        title,
        description: description || ''
      },
      status: {
        privacyStatus: privacyStatus || 'public'
      }
    }, token)

    return {
      playlistId: data.id,
      url: `https://www.youtube.com/playlist?list=${data.id}`
    }
  }

  async _addToPlaylist(params, ctx) {
    const { playlistId, videoId, account } = params
    const token = this._getToken(account, ctx)

    const data = await ytApi('POST', '/playlistItems?part=snippet', {
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId
        }
      }
    }, token)

    return { itemId: data.id }
  }

  async _updateVideo(params, ctx) {
    const { videoId, title, description, tags, categoryId, account } = params
    const token = this._getToken(account, ctx)

    const snippet = { videoId }
    if (title) snippet.title = title
    if (description) snippet.description = description
    if (tags) snippet.tags = tags
    if (categoryId) snippet.categoryId = categoryId

    const data = await ytApi('PUT', '/videos?part=snippet', {
      id: videoId,
      snippet
    }, token)

    return { videoId: data.id }
  }

  _getToken(account, ctx) {
    if (account?.accessToken) return account.accessToken
    const token = ctx?.config?.accounts?.youtube?.accessToken ||
                  process.env.YOUTUBE_ACCESS_TOKEN
    if (!token) throw new Error('YouTube OAuth access token required')
    return token
  }
}

function ytApi(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body)
    const opts = {
      hostname: 'www.googleapis.com',
      path: `/youtube/v3${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode >= 400) {
            reject(new Error(`YouTube API ${res.statusCode}: ${parsed.error?.message || data.slice(0, 200)}`))
          } else { resolve(parsed) }
        } catch (e) { reject(new Error(`Invalid YouTube response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('YouTube API timeout')) })
    req.write(json)
    req.end()
  })
}

module.exports = { YouTubeAdapter }
