const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Form Filler', () => {
  const { smartFill, fillContentEditable, fillReactInput } = require('../src/act/form-filler')

  it('should export all functions', () => {
    assert.ok(typeof smartFill === 'function')
    assert.ok(typeof fillContentEditable === 'function')
    assert.ok(typeof fillReactInput === 'function')
  })
})
