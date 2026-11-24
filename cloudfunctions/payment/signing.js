const crypto = require('crypto')
const { OFFER_ID, PRODUCTS } = require('./payment-config')

function hmac(key, message) {
  if (typeof key !== 'string' || !key || typeof message !== 'string') {
    throw new Error('Invalid signing input')
  }
  return crypto.createHmac('sha256', key).update(message, 'utf8').digest('hex')
}

function signPayRequest(uri, body, appKey) {
  if (typeof uri !== 'string' || !uri || uri.includes('?') || typeof body !== 'string') {
    throw new Error('Invalid payment request')
  }
  return hmac(appKey, `${uri}&${body}`)
}

function createPaymentParameters({ productId, orderId, attach, appKey, sessionKey, env = 0 }) {
  if (env !== 0 && env !== 1) throw new Error('Invalid payment environment')
  if (typeof productId !== 'string' || !Object.prototype.hasOwnProperty.call(PRODUCTS, productId)) {
    throw new Error('Unknown product')
  }
  if (typeof orderId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,31}$/.test(orderId)) {
    throw new Error('Invalid order ID')
  }
  if (typeof attach !== 'string' || !attach) throw new Error('Missing attach')

  const signData = JSON.stringify({
    offerId: OFFER_ID,
    buyQuantity: 1,
    env,
    currencyType: 'CNY',
    productId,
    goodsPrice: PRODUCTS[productId].price,
    outTradeNo: orderId,
    attach
  })
  return {
    mode: 'short_series_goods',
    signData,
    paySig: signPayRequest('requestVirtualPayment', signData, appKey),
    signature: hmac(sessionKey, signData)
  }
}

module.exports = { hmac, signPayRequest, createPaymentParameters }
