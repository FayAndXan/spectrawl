declare module 'spectrawl' {
  export interface SearchResult {
    sources: Array<{
      url: string
      title: string
      snippet?: string
      content?: string
    }>
    answer?: string
    engine: string
    cached: boolean
  }

  export interface BrowseResult {
    content?: string
    html?: string
    screenshot?: Buffer
    url: string
    title: string
    engine: 'stealth-playwright' | 'camoufox' | 'remote-camoufox' | 'playwright'
    cached: boolean
    cookies?: any[]
  }

  export interface ActResult {
    success: boolean
    error?: string
    detail?: string
    suggestion?: string
    retryAfter?: number
    url?: string
    [key: string]: any
  }

  export interface AccountStatus {
    platform: string
    account: string
    status: 'valid' | 'expiring' | 'expired' | 'unknown'
    expiresAt?: string
    cookieCount?: number
  }

  export interface SearchOptions {
    summarize?: boolean
    minResults?: number
    noCache?: boolean
  }

  export interface BrowseOptions {
    screenshot?: boolean
    fullPage?: boolean
    html?: boolean
    extract?: boolean
    stealth?: boolean
    camoufox?: boolean
    noCache?: boolean
    saveCookies?: boolean
    _cookies?: any[]
  }

  export interface ActParams {
    text?: string
    title?: string
    body?: string
    account?: string
    group?: string
    postUrl?: string
    tweetId?: string
    mediaIds?: string[]
    _cookies?: any[]
    [key: string]: any
  }

  export class Spectrawl {
    constructor(config?: any)
    search(query: string, opts?: SearchOptions): Promise<SearchResult>
    browse(url: string, opts?: BrowseOptions): Promise<BrowseResult>
    act(platform: string, action: string, params?: ActParams): Promise<ActResult>
    status(): Promise<AccountStatus[]>
    close(): Promise<void>
  }

  export function installStealth(): Promise<{
    path: string
    binary?: string
    version: string
  }>

  export function isStealthInstalled(): boolean
}
