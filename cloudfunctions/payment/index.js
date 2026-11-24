const https = require('https')
const cloud = require('wx-server-sdk')
const { createHandler } = require('./handler')
const { createWechatApi } = require('./wechat-api')
const { handleDelivery } = require('./delivery-notify')
const { lockId, reserveOrder } = require('./order-reservation')
const { logPayment } = require('./diagnostics')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const sandboxEnabled = process.env.VIRTUAL_PAYMENT_SANDBOX === '1'
const paymentEnv = sandboxEnabled ? 1 : 0
const appKey = sandboxEnabled ? process.env.VIRTUAL_PAYMENT_SANDBOX_APP_KEY : process.env.VIRTUAL_PAYMENT_APP_KEY
const orders = db.collection(sandboxEnabled ? 'payment_sandbox_orders' : 'payment_orders')
const locks = db.collection(sandboxEnabled ? 'payment_sandbox_order_locks' : 'payment_order_locks')
const wechat = createWechatApi({
  appId: process.env.WECHAT_APPID,
  appSecret: process.env.WECHAT_APP_SECRET,
  appKey,
  paymentEnv
})

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
  const deps = {
    appKey,
    paymentEnv,
    sandboxEnabled,
    exchangeCode,
    getRecord: async id => {
      const result = await db.collection('test_records').where({ _id: id, owner: OPENID }).limit(1).get()
      return result.data[0]
    },
    listPendingOrders: async owner => {
      const result = await orders.where({
        owner, status: 'pending', revoked: false
      }).orderBy('createdAt', 'desc').limit(20).get()
      return result.data
    },
    queryOrder: (owner, orderId) => wechat.queryOrder(owner, orderId),
    hasAccess: async (owner, recordId) => {
      const base = { owner, status: 'delivered', revoked: false }
      const permanent = await orders.where(Object.assign({}, base, { productId: 'always' })).limit(1).get()
      if (permanent.data.length) return true
      const single = await orders.where(Object.assign({}, base, { productId: 'one_time', recordId })).limit(1).get()
      return single.data.length > 0
    },
    markDelivered: async order => {
      const result = await orders.where({
        _id: order._id, owner: order.owner, orderId: order.orderId,
        status: 'pending', revoked: false
      }).update({ data: { status: 'delivered', deliveredAt: new Date() } })
      if (result.stats.updated === 1) await releaseLock(order)
      return result.stats.updated === 1
    },
    markClosed: async order => {
      const result = await orders.where({
        _id: order._id, owner: order.owner, orderId: order.orderId,
        status: 'pending', revoked: false
      }).update({ data: { status: 'closed', closedAt: new Date() } })
      if (result.stats.updated === 1) await releaseLock(order)
      return result.stats.updated === 1
    },
    findOrder: async (orderId, owner) => {
      const result = await orders.where({ orderId, owner }).limit(1).get()
      return result.data[0]
    }
  }
  async function releaseLock(order) {
    await locks.where({ _id: lockId(order.owner), owner: order.owner, orderId: order.orderId }).remove()
  }
  deps.insertOrder = order => reserveOrder(order, {
    clearTerminalLock: async (id, owner) => {
      const result = await locks.where({ _id: id, owner }).limit(1).get()
      const lock = result.data[0]
      if (!lock) return
      const previous = await deps.findOrder(lock.orderId, owner)
      if (previous && (previous.status === 'delivered' || previous.status === 'closed')) {
        await locks.where({ _id: id, owner, orderId: lock.orderId }).remove()
      }
    },
    acquire: async lock => {
      const result = await locks.add({ data: lock })
      if (result._id !== lock._id) throw new Error('Lock ID not supported')
    },
    release: async (id, owner, orderId) => {
      await locks.where({ _id: id, owner, orderId }).remove()
    },
    hasAccess: deps.hasAccess,
    listPending: deps.listPendingOrders,
    insert: async data => { await orders.add({ data }) }
  })
  if (event && event.Event) {
    if (event.Event !== 'xpay_goods_deliver_notify') return { ErrCode: 1, ErrMsg: 'event not handled' }
    try {
      logPayment('delivery_notify_received')
      const result = await handleDelivery(event, deps)
      logPayment(result.ErrCode === 0 ? 'delivery_notify_success' : 'delivery_notify_rejected')
      return result
    } catch (error) {
      logPayment('delivery_notify_failed')
      return { ErrCode: 1, ErrMsg: 'delivery failed' }
    }
  }
  return createHandler(deps)(event, OPENID)
}
