const assert = require('assert')

let definition
global.Page = page => { definition = page }
require('../miniprogram/pages/index/index')

async function run() {
  const calls = []
  let modal = ''
  global.wx = {
    login: async () => ({ code: 'login-code' }),
    cloud: {
      callFunction: async request => {
        calls.push(request.name + ':' + request.data.action)
        if (request.name === 'payment' && request.data.action === 'create') {
          return { result: { ok: true, orderId: 'T12345678', payData: {} } }
        }
        if (request.name === 'payment') return { result: { ok: true, updated: false } }
        return { result: { ok: true, locked: true } }
      }
    },
    requestVirtualPayment: options => options.success(),
    getSystemInfoSync: () => ({ platform: 'android', version: '8.0.68' }),
    showModal: options => { modal = options.title },
    showToast: () => {}
  }
  const page = Object.assign({}, definition, {
    data: Object.assign({}, definition.data, { view: 'locked', recordId: 'r1' }),
    setData(values) { Object.assign(this.data, values) }
  })
  await page.buy({ currentTarget: { dataset: { product: 'one_time' } } })
  assert.strictEqual(page.data.view, 'locked')
  assert.strictEqual(page.data.loading, false)
  assert.strictEqual(modal, '支付状态尚未确认')
  assert.deepStrictEqual(calls, ['payment:create', 'records:get', 'payment:reconcile', 'records:get'])
  calls.length = 0
  wx.getSystemInfoSync = () => ({ platform: 'ios', version: '8.0.67' })
  await page.buy({ currentTarget: { dataset: { product: 'one_time' } } })
  assert.strictEqual(modal, '暂无法支付')
  assert.deepStrictEqual(calls, [])
  assert.strictEqual(page.data.loading, false)
  console.log('payment page tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
