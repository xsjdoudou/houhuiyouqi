const assert = require('assert')
const { hmac, signPayRequest, createPaymentParameters } = require('../cloudfunctions/payment/signing')

assert.strictEqual(
  hmac('key', 'The quick brown fox jumps over the lazy dog'),
  'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8'
)
assert.throws(() => signPayRequest('/xpay/query_order?token=x', '{}', 'key'))

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
