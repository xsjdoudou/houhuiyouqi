const assert = require('assert')
const { createQueryOrderRequest } = require('../cloudfunctions/payment/query-order')
const { signPayRequest } = require('../cloudfunctions/payment/signing')

const request = createQueryOrderRequest({
  openid: 'user-openid',
  orderId: 'T1234567',
  accessToken: 'token+with/special',
  appKey: 'test-key'
})
const url = new URL(request.url)
assert.strictEqual(url.origin, 'https://api.weixin.qq.com')
assert.strictEqual(url.pathname, '/xpay/query_order')
assert.strictEqual(url.searchParams.get('access_token'), 'token+with/special')
assert.strictEqual(url.searchParams.get('pay_sig'), signPayRequest('/xpay/query_order', request.body, 'test-key'))
assert.deepStrictEqual(JSON.parse(request.body), {
  openid: 'user-openid', env: 0, order_id: 'T1234567'
})

const valid = { openid: 'user', orderId: 'T1234567', accessToken: 'token', appKey: 'key' }
for (const input of [
  { openid: '' }, { orderId: '_1234567' }, { orderId: 'short' },
  { accessToken: '' }, { appKey: '' }
]) {
  assert.throws(() => createQueryOrderRequest(Object.assign({}, valid, input)))
}

console.log('payment query order tests passed')
