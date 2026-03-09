const https = require('https')

/**
 * HuggingFace platform adapter.
 * Uses HF Hub API for model/dataset/space management.
 * Docs: https://huggingface.co/docs/hub/api
 */
class HuggingFaceAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'create-repo':
        return this._createRepo(params, ctx)
      case 'create-model-card':
        return this._createModelCard(params, ctx)
      case 'upload-file':
        return this._uploadFile(params, ctx)
      default:
        throw new Error(`Unsupported HuggingFace action: ${action}`)
    }
  }

  async _createRepo(params, ctx) {
    const { name, type, private: isPrivate, account } = params
    const token = this._getToken(account, ctx)

    const data = await hfApi('POST', '/api/repos/create', {
      name,
      type: type || 'model', // model, dataset, space
      private: isPrivate || false
    }, token)

    return {
      url: data.url || `https://huggingface.co/${data.repoId || name}`,
      repoId: data.repoId
    }
  }

  async _createModelCard(params, ctx) {
    const { repo, content, account } = params
    const token = this._getToken(account, ctx)

    // Upload README.md to the repo
    const data = await hfApi('PUT', `/api/${repo}/upload/main/README.md`, content, token, 'text/plain')
    return { updated: true, repo }
  }

  async _uploadFile(params, ctx) {
    const { repo, path, content, branch, account } = params
    const token = this._getToken(account, ctx)

    const data = await hfApi('PUT', `/api/${repo}/upload/${branch || 'main'}/${path}`, content, token,
      typeof content === 'string' ? 'text/plain' : 'application/octet-stream')
    return { uploaded: true, path }
  }

  _getToken(account, ctx) {
    if (account?.token) return account.token
    const token = ctx?.config?.accounts?.huggingface?.token ||
                  process.env.HF_TOKEN ||
                  process.env.HUGGINGFACE_TOKEN
    if (!token) throw new Error('HuggingFace token required. Get one from huggingface.co/settings/tokens')
    return token
  }
}

function hfApi(method, path, body, token, contentType) {
  return new Promise((resolve, reject) => {
    const isJson = !contentType || contentType === 'application/json'
    const payload = isJson && typeof body === 'object' ? JSON.stringify(body) : (body || '')
    const opts = {
      hostname: 'huggingface.co',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': contentType || 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          if (res.statusCode >= 400) {
            reject(new Error(`HF API ${res.statusCode}: ${parsed.error || data.slice(0, 200)}`))
          } else { resolve(parsed) }
        } catch (e) {
          if (res.statusCode < 300) resolve({ raw: data })
          else reject(new Error(`HF API error: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('HF API timeout')) })
    req.write(payload)
    req.end()
  })
}

module.exports = { HuggingFaceAdapter }
