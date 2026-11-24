const assert = require('assert')
const { createOrder } = require('../cloudfunctions/payment/create-order')

async function run() {
  const written = []
  const deps = {
    appKey: 'test-key',
    getRecord: async () => ({ _id: 'record1', owner: 'user1' }),
    exchangeCode: async () => ({ openid: 'user1', sessionKey: 'session-key' }),
    insertOrder: async order => { written.push(order) }
  }
  const input = { owner: 'user1', recordId: 'record1', productId: 'one_time', loginCode: 'code' }
  const first = await createOrder(input, deps)
  const second = await createOrder(input, deps)
  assert.notStrictEqual(first.orderId, second.orderId)
  assert.match(first.orderId, /^[A-Za-z0-9][A-Za-z0-9_-]{7,31}$/)
  assert.strictEqual(written[0].price, 90)
  assert.strictEqual(written[0].recordId, 'record1')
  assert.strictEqual(written[0].status, 'pending')
  assert.strictEqual(JSON.parse(first.payData.signData).outTradeNo, first.orderId)
  assert.strictEqual(JSON.stringify(first).includes('session-key'), false)

  await assert.rejects(createOrder(Object.assign({}, input, { productId: '__proto__' }), deps))
  await assert.rejects(createOrder(Object.assign({}, input, { owner: 'other' }), deps))
  await assert.rejects(createOrder(input, Object.assign({}, deps, {
    exchangeCode: async () => ({ openid: 'other', sessionKey: 'key' })
  })))
  await assert.rejects(createOrder(input, Object.assign({}, deps, {
    insertOrder: async () => { throw new Error('storage failed') }
  })))
  assert.strictEqual(written.length, 2)
  console.log('payment create order tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
