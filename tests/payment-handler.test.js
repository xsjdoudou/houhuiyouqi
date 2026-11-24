const assert = require('assert')
const { createHandler, checkPurchase } = require('../cloudfunctions/payment/handler')

async function run() {
  const handle = createHandler({
    getRecord: () => { throw new Error('payment must remain disabled') }
  })
  assert.deepStrictEqual(await handle({ action: 'create' }, ''), { ok: false, code: 'UNAUTHENTICATED' })
  assert.deepStrictEqual(await handle({ action: 'notify' }, 'user1'), { ok: false, code: 'INVALID_ACTION' })
  assert.deepStrictEqual(await handle({ action: 'create' }, 'user1'), { ok: false, code: 'PAYMENT_NOT_READY' })
  for (const options of [
    { paymentEnv: 0, sandboxEnabled: true, appKey: 'sandbox-key' },
    { paymentEnv: 1, sandboxEnabled: false, appKey: 'sandbox-key' },
    { paymentEnv: 1, sandboxEnabled: true, appKey: '' }
  ]) {
    assert.deepStrictEqual(await createHandler(options)({ action: 'create' }, 'user1'),
      { ok: false, code: 'PAYMENT_NOT_READY' })
  }
  assert.deepStrictEqual(await handle(null, 'user1'), { ok: false, code: 'INVALID_ACTION' })
  const deps = {
    getRecord: async () => ({ _id: 'r1', owner: 'user1' }),
    listPendingOrders: async () => [],
    hasAccess: async () => false
  }
  assert.strictEqual(await checkPurchase('user1', 'r1', deps), '')
  assert.strictEqual(await checkPurchase('user1', 'r1', Object.assign({}, deps, { hasAccess: async () => true })), 'ALREADY_UNLOCKED')
  assert.strictEqual(await checkPurchase('user1', 'r1', Object.assign({}, deps, {
    listPendingOrders: async () => [{ owner: 'another-user' }]
  })), 'ORDER_PENDING')
  const written = []
  const sandbox = createHandler(Object.assign({}, deps, {
    paymentEnv: 1,
    sandboxEnabled: true,
    appKey: 'sandbox-key',
    exchangeCode: async () => ({ openid: 'user1', sessionKey: 'session-key' }),
    insertOrder: async order => written.push(order)
  }))
  const result = await sandbox({ action: 'create', recordId: 'r1', productId: 'one_time', loginCode: 'code' }, 'user1')
  assert.strictEqual(result.ok, true)
  assert.strictEqual(JSON.parse(result.payData.signData).env, 1)
  assert.strictEqual(written.length, 1)
  console.log('payment handler tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
