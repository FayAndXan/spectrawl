const https = require('https')

/**
 * GitHub platform adapter.
 * Uses GitHub REST API v3 with personal access tokens.
 * Actions: create repo, create/update file, create discussion, create issue
 */
class GitHubAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'create-repo':
        return this._createRepo(params, ctx)
      case 'create-file':
      case 'push':
        return this._createFile(params, ctx)
      case 'create-issue':
        return this._createIssue(params, ctx)
      case 'create-release':
        return this._createRelease(params, ctx)
      case 'update-readme':
        return this._updateReadme(params, ctx)
      default:
        throw new Error(`Unsupported GitHub action: ${action}`)
    }
  }

  async _createRepo(params, ctx) {
    const { name, description, homepage, topics, isPrivate, account } = params
    const token = this._getToken(account, ctx)

    const data = await ghApi('POST', '/user/repos', {
      name,
      description: description || '',
      homepage: homepage || '',
      private: isPrivate || false,
      auto_init: true
    }, token)

    if (topics?.length) {
      await ghApi('PUT', `/repos/${data.full_name}/topics`, { names: topics }, token)
    }

    return { repoId: data.id, url: data.html_url, fullName: data.full_name }
  }

  async _createFile(params, ctx) {
    const { repo, path, content, message, branch, account } = params
    const token = this._getToken(account, ctx)

    // Check if file exists (for updates)
    let sha
    try {
      const existing = await ghApi('GET', `/repos/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`, null, token)
      sha = existing.sha
    } catch (e) { /* file doesn't exist, that's fine */ }

    const body = {
      message: message || `Update ${path}`,
      content: Buffer.from(content).toString('base64'),
      branch: branch || 'main'
    }
    if (sha) body.sha = sha

    const data = await ghApi('PUT', `/repos/${repo}/contents/${path}`, body, token)
    return { url: data.content?.html_url, sha: data.content?.sha }
  }

  async _createIssue(params, ctx) {
    const { repo, title, body, labels, account } = params
    const token = this._getToken(account, ctx)

    const data = await ghApi('POST', `/repos/${repo}/issues`, {
      title,
      body: body || '',
      labels: labels || []
    }, token)

    return { issueId: data.number, url: data.html_url }
  }

  async _createRelease(params, ctx) {
    const { repo, tag, name, body, draft, prerelease, account } = params
    const token = this._getToken(account, ctx)

    const data = await ghApi('POST', `/repos/${repo}/releases`, {
      tag_name: tag,
      name: name || tag,
      body: body || '',
      draft: draft || false,
      prerelease: prerelease || false
    }, token)

    return { releaseId: data.id, url: data.html_url }
  }

  async _updateReadme(params, ctx) {
    const { repo, content, account } = params
    return this._createFile({ repo, path: 'README.md', content, message: 'Update README', account }, ctx)
  }

  _getToken(account, ctx) {
    if (account?.token) return account.token
    const token = ctx?.config?.accounts?.github?.token ||
                  process.env.GITHUB_TOKEN
    if (!token) throw new Error('GitHub token required')
    return token
  }
}

function ghApi(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Spectrawl/0.1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }

    if (body && method !== 'GET') {
      const json = JSON.stringify(body)
      opts.headers['Content-Type'] = 'application/json'
      opts.headers['Content-Length'] = Buffer.byteLength(json)
    }

    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || data.slice(0, 200)}`))
          } else {
            resolve(parsed)
          }
        } catch (e) { reject(new Error(`Invalid GitHub response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub API timeout')) })
    if (body && method !== 'GET') req.write(JSON.stringify(body))
    req.end()
  })
}

module.exports = { GitHubAdapter }
