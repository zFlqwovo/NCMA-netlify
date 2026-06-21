const serverless = require('serverless-http')

let handler = null

async function getHandler() {
  if (handler) return handler

  // 初始化 anonymous_token 文件
  const fs = require('fs')
  const path = require('path')
  const tmpPath = require('os').tmpdir()
  const anonymousTokenPath = path.resolve(tmpPath, 'anonymous_token')

  if (!fs.existsSync(anonymousTokenPath)) {
    fs.writeFileSync(anonymousTokenPath, '', 'utf-8')
  }

  // 启动时更新 anonymous_token
  const generateConfig = require('../../generateConfig')
  try {
    await generateConfig()
  } catch (e) {
    console.log('generateConfig failed, continuing without:', e.message)
  }

  // 构建并包裹 Express 应用
  const { constructServer } = require('../../server')
  const app = await constructServer()
  handler = serverless(app, { basePath: '/.netlify/functions/api' })
  return handler
}

exports.handler = async (event, context) => {
  // 规范化 event：确保 body 不为 null，requestContext.identity.sourceIp 存在
  if (event.body === null || event.body === undefined) {
    event.body = ''
  }
  event.requestContext = event.requestContext || {}
  event.requestContext.identity = event.requestContext.identity || {}
  if (!event.requestContext.identity.sourceIp) {
    event.requestContext.identity.sourceIp = '127.0.0.1'
  }

  const h = await getHandler()
  return h(event, context)
}
