const { signPayRequest } = require('./signing')

const QUERY_PATH = '/xpay/query_order'

function createQueryOrderRequest({ openid, orderId, accessToken, appKey }) {
  if (typeof openid !== 'string' || !openid) throw new Error('Missing openid')
  if (typeof orderId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,31}$/.test(orderId)) {
    throw new Error('Invalid order ID')
  }
  if (typeof accessToken !== 'string' || !accessToken) throw new Error('Missing access token')

  const body = JSON.stringify({ openid, env: 0, order_id: orderId })
  const paySig = signPayRequest(QUERY_PATH, body, appKey)
  const url = new URL('https://api.weixin.qq.com' + QUERY_PATH)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('pay_sig', paySig)
  return { url: url.toString(), body }
}

module.exports = { createQueryOrderRequest }
