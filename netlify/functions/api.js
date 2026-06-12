const fs = require('fs')
const path = require('path')
const serverless = require('serverless-http')
const tmpPath = require('os').tmpdir()

// Ensure anonymous_token exists
const anonymousTokenPath = path.resolve(tmpPath, 'anonymous_token')
if (!fs.existsSync(anonymousTokenPath)) {
  fs.writeFileSync(anonymousTokenPath, '', 'utf-8')
}

let handler = null

exports.handler = async (event, context) => {
  if (!handler) {
    // Initialize config on cold start
    try {
      const generateConfig = require('../../generateConfig')
      await generateConfig()
    } catch (e) {
      console.warn('generateConfig failed (non-fatal):', e.message)
    }

    const { serveNcmApi } = require('../../server')

    const app = await serveNcmApi({
      checkVersion: false,
    })

    handler = serverless(app, {
      binary: ['image/*', 'audio/*', 'application/octet-stream'],
    })
  }

  return handler(event, context)
}