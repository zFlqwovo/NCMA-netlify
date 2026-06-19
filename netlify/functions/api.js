const http = require('http')
const { URL } = require('url')
const fs = require('fs')
const path = require('path')
const tmpPath = require('os').tmpdir()

// Ensure anonymous_token file exists
if (!fs.existsSync(path.resolve(tmpPath, 'anonymous_token'))) {
  fs.writeFileSync(path.resolve(tmpPath, 'anonymous_token'), '', 'utf-8')
}

let app = null
let server = null

async function init() {
  const generateConfig = require('../../generateConfig')
  await generateConfig()
  const { constructServer } = require('../../server')
  app = await constructServer()
  server = http.createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
}

exports.handler = async (event, context) => {
  if (!server) await init()

  const method = (event.httpMethod || 'GET').toLowerCase()
  const headers = { ...(event.headers || {}) }
  const body = event.body || null
  const isBase64 = event.isBase64Encoded

  let url = new URL(event.path || '/', `http://127.0.0.1:${server.address().port}`)
  if (event.queryStringParameters) {
    Object.entries(event.queryStringParameters).forEach(([k, v]) => {
      url.searchParams.set(k, v)
    })
  }
  if (event.multiValueQueryStringParameters) {
    Object.entries(event.multiValueQueryStringParameters).forEach(([k, vs]) => {
      vs.forEach((v) => url.searchParams.append(k, v))
    })
  }

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: server.address().port,
      path: url.pathname + url.search,
      method: event.httpMethod || 'GET',
      headers,
    }

    const req = http.request(opts, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        const resHeaders = { ...res.headers }
        delete resHeaders['transfer-encoding']
        delete resHeaders['connection']

        let resBody
        let isBase64Encoded = false
        const contentType = (resHeaders['content-type'] || '').toLowerCase()
        if (
          contentType.includes('image/') ||
          contentType.includes('audio/') ||
          contentType.includes('octet-stream')
        ) {
          resBody = buf.toString('base64')
          isBase64Encoded = true
        } else {
          resBody = buf.toString('utf-8')
        }

        resolve({
          statusCode: res.statusCode,
          headers: resHeaders,
          body: resBody,
          isBase64Encoded,
        })
      })
    })

    req.on('error', (err) => {
      resolve({
        statusCode: 502,
        body: JSON.stringify({ code: 502, msg: err.message }),
      })
    })

    if (body) {
      const data = isBase64 ? Buffer.from(body, 'base64') : body
      req.write(data)
    }
    req.end()
  })
}
