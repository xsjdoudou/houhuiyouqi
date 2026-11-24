const assert = require('assert')
const { hmac, signPayRequest, createPaymentParameters } = require('../cloudfunctions/payment/signing')
const { createQueryOrderRequest } = require('../cloudfunctions/payment/query-order')

assert.strictEqual(
  hmac('key', 'The quick brown fox jumps over the lazy dog'),
  'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
)
assert.throws(() => signPayRequest('/xpay/query_order?token=x', '{}', 'key'))

// Fixed vectors calculated independently with OpenSSL using non-secret test keys.
const vector = createPaymentParameters({
  productId: 'one_time', orderId: 'T1234567', attach: 'T1234567',
  appKey: 'app-key', sessionKey: 'session-key'
})
assert.strictEqual(vector.signData, '{"offerId":"1450737028","buyQuantity":1,"env":0,"currencyType":"CNY","productId":"one_time","goodsPrice":90,"outTradeNo":"T1234567","attach":"T1234567"}')
assert.strictEqual(vector.paySig, '448b452a1f6d7c871cf50207a866e0bbe7ddbbaae234706e5c3c33d76e44cd61')
assert.strictEqual(vector.signature, '4cd1f0da17ac379c92875fe6ca20093c32ce9f4357fd3bafcdee4c26666e2975')
const queryVector = createQueryOrderRequest({
  openid: 'user1', orderId: 'T12345678', accessToken: 'token', appKey: 'key'
})
assert.strictEqual(queryVector.body, '{"openid":"user1","env":0,"order_id":"T12345678"}')
assert.strictEqual(new URL(queryVector.url).searchParams.get('pay_sig'), 'dcea97dec0b9266bd0dc5967fe1a0a8075129faa03d4c4e34944df9d836bdc75')

for (const [productId, price] of [['one_time', 90], ['always', 390]]) {
  const params = createPaymentParameters({
    productId, orderId: 'T1234567', attach: 'T1234567', appKey: 'app-key', sessionKey: 'session-key'
  })
  const data = JSON.parse(params.signData)
  assert.strictEqual(params.mode, 'short_series_goods')
  assert.strictEqual(data.productId, productId)
  assert.strictEqual(data.goodsPrice, price)
  assert.strictEqual(data.offerId, '1450737028')
  assert.strictEqual(data.outTradeNo, 'T1234567')
  assert.strictEqual(data.attach, 'T1234567')
  assert.strictEqual(data.env, 0)
  assert.strictEqual(params.paySig, signPayRequest('requestVirtualPayment', params.signData, 'app-key'))
  assert.strictEqual(params.signature, hmac('session-key', params.signData))
}

const valid = { productId: 'one_time', orderId: 'T1234567', attach: 'T1234567', appKey: 'key', sessionKey: 'key' }
for (const input of [
  { productId: '__proto__' }, { productId: 'unknown' }, { orderId: '_1234567' },
  { orderId: 'short' }, { attach: '' }, { appKey: '' }, { sessionKey: '' }
]) assert.throws(() => createPaymentParameters(Object.assign({}, valid, input)))

console.log('payment signing tests passed')
