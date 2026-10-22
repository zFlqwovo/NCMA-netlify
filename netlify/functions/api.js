const serverless = require('serverless-http')

let handler = null

async function getHandler() {
  if (handler) return handler
  const generateConfig = require('../../generateConfig')
  try {
    await generateConfig()
  } catch (e) {
    console.log('generateConfig failed, continuing without:', e.message)
  }
  const { constructServer } = require('../../server')
  const app = await constructServer()
  handler = serverless(app)
  return handler
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false
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
