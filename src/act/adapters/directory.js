/**
 * Generic directory submission adapter.
 * Handles Tier 2 launch/SaaS directories that all have similar forms:
 * name, url, tagline, description, email, category.
 * 
 * Supported directories (with custom selectors):
 * - MicroLaunch, Uneed, Peerlist, Fazier, BetaPage
 * - LaunchingNext, StartupStash, SideProjectors
 * - TAIFT, Futurepedia, Toolify, OpenTools
 * - Crunchbase, G2, StackShare (profile claim)
 * 
 * Falls back to generic form detection for unknown directories.
 */

const DIRECTORY_CONFIGS = {
  microlaunch: {
    submitUrl: 'https://microlaunch.net/submit',
    fields: {
      name: 'input[name="name"], input[placeholder*="product name"]',
      url: 'input[name="url"], input[type="url"]',
      tagline: 'input[name="tagline"], input[placeholder*="tagline"]',
      description: 'textarea[name="description"]',
    }
  },
  uneed: {
    submitUrl: 'https://www.uneed.best/submit',
    fields: {
      name: 'input[name="name"]',
      url: 'input[name="url"], input[type="url"]',
      tagline: 'input[name="tagline"], input[name="slogan"]',
      description: 'textarea[name="description"]',
    }
  },
  peerlist: {
    submitUrl: 'https://peerlist.io/projects/new',
    fields: {
      name: 'input[name="name"], input[placeholder*="project name"]',
      url: 'input[name="url"], input[type="url"]',
      tagline: 'input[name="tagline"]',
      description: 'textarea[name="description"]',
    }
  },
  fazier: {
    submitUrl: 'https://fazier.com/submit',
    fields: {
      name: 'input[name="name"]',
      url: 'input[name="url"]',
      tagline: 'input[name="tagline"]',
      description: 'textarea[name="description"]',
    }
  },
  betapage: {
    submitUrl: 'https://betapage.co/submit-startup',
    fields: {
      name: 'input[name="name"], #startup_name',
      url: 'input[name="url"], input[name="website"]',
      tagline: 'input[name="tagline"], input[name="oneliner"]',
      description: 'textarea[name="description"]',
      email: 'input[name="email"], input[type="email"]',
    }
  },
  launchingnext: {
    submitUrl: 'https://www.launchingnext.com/submit/',
    fields: {
      name: 'input[name="name"], input[id="name"]',
      url: 'input[name="url"], input[id="url"]',
      tagline: 'input[name="tagline"]',
      description: 'textarea[name="description"]',
      email: 'input[name="email"]',
    }
  },
  startupstash: {
    submitUrl: 'https://startupstash.com/add-listing/',
    fields: {
      name: 'input[name="title"], input[name="name"]',
      url: 'input[name="url"], input[name="website"]',
      description: 'textarea[name="description"], textarea[name="content"]',
    }
  },
  sideprojectors: {
    submitUrl: 'https://www.sideprojectors.com/project/new',
    fields: {
      name: 'input[name="title"], input[name="name"]',
      url: 'input[name="url"]',
      description: 'textarea[name="description"]',
    }
  },
  taift: {
    submitUrl: 'https://theresanaiforthat.com/submit/',
    fields: {
      name: 'input[name="name"], input[placeholder*="name"]',
      url: 'input[name="url"], input[type="url"]',
      tagline: 'input[name="tagline"], input[name="short_description"]',
      description: 'textarea[name="description"]',
    }
  },
  futurepedia: {
    submitUrl: 'https://www.futurepedia.io/submit-tool',
    fields: {
      name: 'input[name="name"]',
      url: 'input[name="url"]',
      tagline: 'input[name="tagline"]',
      description: 'textarea[name="description"]',
    }
  },
  crunchbase: {
    submitUrl: 'https://www.crunchbase.com/add-new',
    fields: {
      name: 'input[name="name"], input[placeholder*="organization"]',
      url: 'input[name="url"], input[name="website"]',
      description: 'textarea[name="description"], textarea[name="short_description"]',
    }
  },
  g2: {
    submitUrl: 'https://www.g2.com/products/new',
    fields: {
      name: 'input[name="name"], input[name="product_name"]',
      url: 'input[name="url"], input[name="website"]',
      description: 'textarea[name="description"]',
    }
  },
  stackshare: {
    submitUrl: 'https://stackshare.io/tools/new',
    fields: {
      name: 'input[name="name"]',
      url: 'input[name="url"]',
      tagline: 'input[name="tagline"]',
      description: 'textarea[name="description"]',
    }
  },
  appsumo: {
    submitUrl: 'https://sell.appsumo.com/',
    fields: {
      name: 'input[name="name"], input[name="product_name"]',
      url: 'input[name="url"]',
      description: 'textarea[name="description"]',
    }
  }
}

class DirectoryAdapter {
  async execute(action, params, ctx) {
    switch (action) {
      case 'post':
      case 'submit':
        return this._submit(params, ctx)
      case 'list-directories':
        return { directories: Object.keys(DIRECTORY_CONFIGS) }
      default:
        throw new Error(`Unsupported Directory action: ${action}`)
    }
  }

  async _submit(params, ctx) {
    const { directory, name, url, tagline, description, email, category, _cookies, _browse } = params
    if (!_browse) throw new Error('Directory submission requires browse engine')

    const config = DIRECTORY_CONFIGS[directory?.toLowerCase()]
    const submitUrl = config?.submitUrl || params.submitUrl
    if (!submitUrl) {
      throw new Error(`Unknown directory "${directory}". Known: ${Object.keys(DIRECTORY_CONFIGS).join(', ')}. Or pass submitUrl directly.`)
    }

    const page = await _browse(submitUrl, {
      cookies: _cookies,
      getPage: true
    })

    const pw = page._page
    if (!pw) throw new Error('Directory adapter requires getPage access')

    await pw.waitForSelector('input, form', { timeout: 15000 })

    // Fill known fields
    const fields = config?.fields || {}
    const data = { name, url, tagline, description, email, category }

    for (const [field, value] of Object.entries(data)) {
      if (!value) continue
      
      // Try config selector first, then generic selectors
      const selectors = [
        fields[field],
        `input[name="${field}"]`,
        `textarea[name="${field}"]`,
        `input[placeholder*="${field}"]`,
        `#${field}`
      ].filter(Boolean)

      for (const sel of selectors) {
        try {
          const el = await pw.$(sel)
          if (el) {
            const tag = await el.evaluate(e => e.tagName.toLowerCase())
            if (tag === 'textarea') {
              await el.fill(value)
            } else {
              await el.fill(value)
            }
            break
          }
        } catch (e) { /* selector didn't match, try next */ }
      }
    }

    // Try to submit
    try {
      await pw.click('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Launch"), button:has-text("Add")')
      await pw.waitForTimeout(3000)
    } catch (e) {
      // No submit button found — might need manual submission
      return { filled: true, submitted: false, note: 'Form filled but submit button not found', directory }
    }

    return { submitted: true, directory: directory || submitUrl, name, url }
  }
}

module.exports = { DirectoryAdapter, DIRECTORY_CONFIGS }
