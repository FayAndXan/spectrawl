declare module 'spectrawl' {
  interface SpectrawlConfig {
    search?: {
      cascade?: string[]
      scrapeTop?: number
      geminiKey?: string
      'gemini-grounded'?: { apiKey?: string; model?: string }
      tavily?: { apiKey?: string; searchDepth?: string; maxResults?: number }
      llm?: { provider: string; model?: string; apiKey?: string }
      sourceRanker?: {
        weights?: Record<string, number>
        boost?: string[]
        block?: string[]
      }
    }
    browse?: {
      defaultEngine?: string
      proxy?: { type: string; host: string; port: number; username?: string; password?: string }
      humanlike?: { minDelay?: number; maxDelay?: number; scrollBehavior?: boolean }
    }
    auth?: {
      refreshInterval?: string
      cookieStore?: string
    }
    cache?: {
      path?: string
      searchTtl?: number
      scrapeTtl?: number
      screenshotTtl?: number
    }
    rateLimit?: Record<string, { postsPerHour?: number; minDelayMs?: number }>
    proxy?: {
      localPort?: number
      strategy?: 'round-robin' | 'random' | 'least-used'
      upstreams?: { url: string }[]
    }
  }

  interface SearchResult {
    title: string
    url: string
    snippet: string
    content?: string
    score?: number
    engine?: string
  }

  interface SearchResponse {
    answer: string | null
    sources: SearchResult[]
    cached: boolean
  }

  interface DeepSearchResponse {
    answer: string | null
    sources: SearchResult[]
    queries: string[]
    cached: boolean
  }

  interface DeepSearchOptions {
    mode?: 'fast' | 'snippets' | 'full'
    scrapeTop?: number
    scrapeTimeout?: number
    expand?: boolean
    rerank?: boolean
    summarize?: boolean
  }

  interface BrowseResult {
    content: string
    text?: string
    screenshot?: Buffer
    engine: string
    url: string
  }

  interface AuthStatus {
    platform: string
    account: string
    status: 'valid' | 'expired' | 'unknown'
    expiresAt?: string
  }

  class Spectrawl {
    constructor(config?: SpectrawlConfig | string)

    /** Basic search — raw results from cascade engines */
    search(query: string, opts?: { summarize?: boolean; scrapeTop?: number; engines?: string[] }): Promise<SearchResponse>

    /** Deep search — Tavily-equivalent with citations. Set GEMINI_API_KEY for best results. */
    deepSearch(query: string, opts?: DeepSearchOptions): Promise<DeepSearchResponse>

    /** Browse a URL with stealth anti-detection */
    browse(url: string, opts?: { screenshot?: boolean; timeout?: number; extractText?: boolean }): Promise<BrowseResult>

    /** Act on a platform (post, comment, submit) */
    act(platform: string, action: string, params: Record<string, any>): Promise<any>

    /** Check auth health for all configured accounts */
    status(): Promise<AuthStatus[]>

    /** Get raw Playwright page for custom automation */
    getPage(url: string, opts?: any): Promise<any>

    /** Close all connections */
    close(): Promise<void>
  }

  export { Spectrawl, SpectrawlConfig, SearchResult, SearchResponse, DeepSearchResponse, DeepSearchOptions, BrowseResult, AuthStatus }
}
