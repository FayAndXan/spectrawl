const https = require('https')

/**
 * Product Hunt platform adapter.
 * Uses GraphQL API v2.
 * Docs: https://api.producthunt.com/v2/docs
 */
class ProductHuntAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'launch':
        return this._launch(params, ctx)
      case 'comment':
        return this._comment(params, ctx)
      case 'upvote':
        return this._upvote(params, ctx)
      default:
        throw new Error(`Unsupported Product Hunt action: ${action}`)
    }
  }

  async _launch(params, ctx) {
    const { name, tagline, url, description, topics, thumbnailUrl, account } = params
    const token = this._getToken(account, ctx)

    // Note: Product Hunt API v2 doesn't directly support creating posts
    // via API anymore — launches go through producthunt.com/posts/new
    // This uses the maker tools endpoint where available
    const query = `
      mutation CreatePost($input: PostCreateInput!) {
        postCreate(input: $input) {
          post {
            id
            name
            tagline
            url
            votesCount
          }
        }
      }
    `

    const data = await graphql(query, {
      input: {
        name,
        tagline,
        url,
        description: description || '',
        topicIds: topics || [],
        thumbnailUrl: thumbnailUrl || ''
      }
    }, token)

    const post = data.data?.postCreate?.post
    if (!post) {
      throw new Error(`Product Hunt launch failed: ${JSON.stringify(data.errors || data)}`)
    }

    return { postId: post.id, url: post.url, name: post.name }
  }

  async _comment(params, ctx) {
    const { postId, body, account } = params
    const token = this._getToken(account, ctx)

    const query = `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          comment {
            id
            body
          }
        }
      }
    `

    const data = await graphql(query, {
      input: { postId, body }
    }, token)

    const comment = data.data?.commentCreate?.comment
    return { commentId: comment?.id }
  }

  async _upvote(params, ctx) {
    const { postId, account } = params
    const token = this._getToken(account, ctx)

    const query = `
      mutation VotePost($input: PostVoteInput!) {
        postVote(input: $input) {
          node {
            id
            votesCount
          }
        }
      }
    `

    const data = await graphql(query, { input: { postId } }, token)
    return { votes: data.data?.postVote?.node?.votesCount }
  }

  _getToken(account, ctx) {
    if (account?.token) return account.token
    const token = ctx?.config?.accounts?.producthunt?.token ||
                  process.env.PRODUCTHUNT_TOKEN
    if (!token) throw new Error('Product Hunt API token required. Get one from producthunt.com/v2/oauth/applications')
    return token
  }
}

function graphql(query, variables, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables })
    const opts = {
      hostname: 'api.producthunt.com',
      path: '/v2/api/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid PH response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('PH API timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { ProductHuntAdapter }
