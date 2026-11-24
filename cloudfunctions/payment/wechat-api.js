const https = require('https')
const { createQueryOrderRequest } = require('./query-order')

function requestJson(url, method, body) {
  return new Promise((resolve, reject) => {
    const options = { method, headers: {} }
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = Buffer.byteLength(body)
    }
    const request = https.request(url, options, response => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        data += chunk
        if (data.length > 65536) request.destroy()
      })
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error()
          resolve(JSON.parse(data))
        } catch (error) {
          reject(new Error('WeChat request failed'))
        }
      })
      response.on('error', () => reject(new Error('WeChat request failed')))
    })
    request.setTimeout(5000, () => request.destroy())
    request.on('error', () => reject(new Error('WeChat request failed')))
    if (body !== undefined) request.write(body)
    request.end()
  })
}

function createWechatApi({ appId, appSecret, appKey, paymentEnv = 0 }, request = requestJson) {
  let cachedToken = ''
  let expiresAt = 0

  async function getAccessToken() {
    if (cachedToken && Date.now() < expiresAt) return cachedToken
    if (!appId || !appSecret) throw new Error('Missing credentials')
    const body = JSON.stringify({ grant_type: 'client_credential', appid: appId, secret: appSecret })
    const response = await request('https://api.weixin.qq.com/cgi-bin/stable_token', 'POST', body)
    if (!response || typeof response.access_token !== 'string' ||
        !response.access_token || !Number.isFinite(response.expires_in)) {
      throw new Error('Access token request failed')
    }
    cachedToken = response.access_token
    expiresAt = Date.now() + Math.max(0, response.expires_in - 300) * 1000
    return cachedToken
  }

  return {
    async queryOrder(openid, orderId) {
      const accessToken = await getAccessToken()
      const query = createQueryOrderRequest({ openid, orderId, accessToken, appKey, env: paymentEnv })
      return request(query.url, 'POST', query.body)
    }
  }
}

module.exports = { createWechatApi, requestJson }
