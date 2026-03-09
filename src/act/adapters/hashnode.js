const https = require('https')

/**
 * Hashnode platform adapter.
 * Uses official GraphQL API.
 */
class HashnodeAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      default:
        throw new Error(`Unsupported Hashnode action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { title, body, tags, publicationId, account } = params
    const apiKey = await this._getApiKey(account, ctx)

    const query = `
      mutation PublishPost($input: PublishPostInput!) {
        publishPost(input: $input) {
          post { id, slug, url, title }
        }
      }
    `

    const variables = {
      input: {
        title,
        contentMarkdown: body,
        publicationId: publicationId || await this._getPublicationId(apiKey),
        tags: (tags || []).map(t => ({ slug: t.toLowerCase().replace(/\s+/g, '-'), name: t }))
      }
    }

    const data = await graphql(apiKey, query, variables)

    if (data.errors) {
      throw new Error(`Hashnode error: ${data.errors[0]?.message}`)
    }

    const post = data.data?.publishPost?.post
    return { postId: post?.id, url: post?.url, slug: post?.slug }
  }

  async _getPublicationId(apiKey) {
    const query = `query { me { publications(first: 1) { edges { node { id } } } } }`
    const data = await graphql(apiKey, query)
    return data.data?.me?.publications?.edges?.[0]?.node?.id
  }

  async _getApiKey(account, ctx) {
    const creds = await ctx.auth.getCookies('hashnode', account)
    if (creds?.apiKey) return creds.apiKey
    if (process.env.HASHNODE_API_KEY) return process.env.HASHNODE_API_KEY
    throw new Error('Hashnode API key not configured')
  }
}

function graphql(apiKey, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables })
    const opts = {
      hostname: 'gql.hashnode.com',
      path: '/',
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid Hashnode response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

module.exports = { HashnodeAdapter }
