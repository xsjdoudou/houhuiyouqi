const assert = require('assert')
const { createHandler } = require('../cloudfunctions/payment/handler')

async function run() {
  const handle = createHandler({
    getRecord: () => { throw new Error('payment must remain disabled') }
  })
  assert.deepStrictEqual(await handle({ action: 'create' }, ''), { ok: false, code: 'UNAUTHENTICATED' })
  assert.deepStrictEqual(await handle({ action: 'notify' }, 'user1'), { ok: false, code: 'INVALID_ACTION' })
  assert.deepStrictEqual(await handle({ action: 'create' }, 'user1'), { ok: false, code: 'PAYMENT_NOT_READY' })
  assert.deepStrictEqual(await handle(null, 'user1'), { ok: false, code: 'INVALID_ACTION' })
  console.log('payment handler tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
