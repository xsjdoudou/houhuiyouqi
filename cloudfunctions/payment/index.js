const https = require('https')
const cloud = require('wx-server-sdk')
const { createHandler } = require('./handler')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function exchangeCode(code) {
  const appId = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_APP_SECRET
  if (!appId || !secret) return Promise.reject(new Error('Missing credentials'))
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.searchParams.set('appid', appId)
  url.searchParams.set('secret', secret)
  url.searchParams.set('js_code', code)
  url.searchParams.set('grant_type', 'authorization_code')
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
        if (body.length > 16384) request.destroy()
      })
      response.on('end', () => {
        try {
          const result = JSON.parse(body)
          if (response.statusCode !== 200 || !result.openid || !result.session_key) throw new Error()
          resolve({ openid: result.openid, sessionKey: result.session_key })
        } catch (error) {
          reject(new Error('Session exchange failed'))
        }
      })
      response.on('error', () => reject(new Error('Session exchange failed')))
    })
    request.setTimeout(5000, () => request.destroy())
    request.on('error', () => reject(new Error('Session exchange failed')))
  })
}

exports.main = async event => {
  const { OPENID } = cloud.getWXContext()
  const handle = createHandler({
    appKey: process.env.VIRTUAL_PAYMENT_APP_KEY,
    exchangeCode,
    getRecord: async id => {
      const result = await db.collection('test_records').where({ _id: id, owner: OPENID }).limit(1).get()
      return result.data[0]
    },
    insertOrder: async order => {
      await db.collection('payment_orders').add({ data: order })
    }
  })
  return handle(event, OPENID)
}
