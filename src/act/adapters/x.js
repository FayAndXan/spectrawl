const https = require('https')
const crypto = require('crypto')

/**
 * X (Twitter) platform adapter.
 * Methods: Cookie API (GraphQL) with OAuth 1.0a fallback.
 */
class XAdapter {
  /**
   * Execute an action on X.
   * @param {string} action - post, like, retweet, delete
   * @param {object} params - { account, text, mediaIds, tweetId, _cookies }
   * @param {object} ctx - { auth, browse }
   */
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
        return this._post(params, ctx)
      case 'like':
        return this._like(params, ctx)
      case 'retweet':
        return this._retweet(params, ctx)
      case 'delete':
        return this._delete(params, ctx)
      default:
        throw new Error(`Unsupported X action: ${action}`)
    }
  }

  async _post(params, ctx) {
    const { text, account, _cookies } = params

    // Try Cookie API (GraphQL) first
    if (_cookies) {
      return this._graphqlPost(text, _cookies)
    }

    // Try OAuth 1.0a if configured
    const oauthCreds = await ctx.auth.getCookies('x', account)
    if (oauthCreds?.oauth) {
      return this._oauthPost(text, oauthCreds.oauth)
    }

    throw new Error(`No auth available for X account ${account}. Run: spectrawl login x --account ${account}`)
  }

  async _graphqlPost(text, cookies) {
    // X GraphQL CreateTweet mutation
    const csrfToken = cookies.find(c => c.name === 'ct0')?.value
    if (!csrfToken) throw new Error('Missing ct0 CSRF token in X cookies')

    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    
    const body = JSON.stringify({
      variables: {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: []
      },
      features: {
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        articles_preview_enabled: true,
        rweb_video_timestamps_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false
      },
      queryId: 'bDE2rBtZb3uyrczSZ_pI9g'
    })

    const data = await postJson(
      'https://x.com/i/api/graphql/bDE2rBtZb3uyrczSZ_pI9g/CreateTweet',
      body,
      {
        'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'X-Csrf-Token': csrfToken,
        'X-Twitter-Auth-Type': 'OAuth2Session',
        'X-Twitter-Active-User': 'yes'
      }
    )

    if (data.errors) {
      throw new Error(`X API error: ${data.errors[0]?.message || JSON.stringify(data.errors)}`)
    }

    const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id
    return { tweetId, url: tweetId ? `https://x.com/i/status/${tweetId}` : null }
  }

  async _oauthPost(text, oauth) {
    // OAuth 1.0a — for accounts with API keys
    const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = oauth
    
    const url = 'https://api.x.com/2/tweets'
    const body = JSON.stringify({ text })
    
    const authHeader = generateOAuthHeader('POST', url, {}, {
      consumerKey, consumerSecret, accessToken, accessTokenSecret
    })

    const data = await postJson(url, body, {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    })

    return { tweetId: data.data?.id, url: `https://x.com/i/status/${data.data?.id}` }
  }

  async _like(params, ctx) {
    // TODO: implement like via GraphQL
    throw new Error('X like not yet implemented')
  }

  async _retweet(params, ctx) {
    // TODO: implement retweet via GraphQL
    throw new Error('X retweet not yet implemented')
  }

  async _delete(params, ctx) {
    // TODO: implement delete via GraphQL
    throw new Error('X delete not yet implemented')
  }
}

function generateOAuthHeader(method, url, params, creds) {
  const oauthParams = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0'
  }

  const allParams = { ...params, ...oauthParams }
  const sortedKeys = Object.keys(allParams).sort()
  const paramStr = sortedKeys.map(k => `${encodeRFC3986(k)}=${encodeRFC3986(allParams[k])}`).join('&')
  const baseStr = `${method}&${encodeRFC3986(url)}&${encodeRFC3986(paramStr)}`
  const signingKey = `${encodeRFC3986(creds.consumerSecret)}&${encodeRFC3986(creds.accessTokenSecret)}`
  
  oauthParams.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(baseStr)
    .digest('base64')

  const header = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeRFC3986(k)}="${encodeRFC3986(oauthParams[k])}"`)
    .join(', ')

  return `OAuth ${header}`
}

function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    }
    const req = https.request(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error(`Invalid response: ${data.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('X API timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = { XAdapter }
