/**
 * Event system for Spectrawl.
 * Proactive notifications to agents about auth state changes.
 */

class EventEmitter {
  constructor() {
    this._handlers = {}
  }

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = []
    this._handlers[event].push(handler)
    return this
  }

  off(event, handler) {
    if (!this._handlers[event]) return
    this._handlers[event] = this._handlers[event].filter(h => h !== handler)
    return this
  }

  emit(event, data) {
    const handlers = this._handlers[event] || []
    for (const handler of handlers) {
      try {
        handler(data)
      } catch (err) {
        console.warn(`Event handler error for ${event}:`, err.message)
      }
    }
    
    // Also emit to wildcard handlers
    const wildcards = this._handlers['*'] || []
    for (const handler of wildcards) {
      try {
        handler({ event, ...data })
      } catch (err) {
        console.warn(`Wildcard handler error:`, err.message)
      }
    }
  }
}

// Standard events
const EVENTS = {
  COOKIE_EXPIRING: 'cookie_expiring',
  COOKIE_EXPIRED: 'cookie_expired',
  AUTH_FAILED: 'auth_failed',
  AUTH_REFRESHED: 'auth_refreshed',
  RATE_LIMITED: 'rate_limited',
  ACTION_FAILED: 'action_failed',
  ACTION_SUCCESS: 'action_success',
  HEALTH_CHECK: 'health_check'
}

module.exports = { EventEmitter, EVENTS }
