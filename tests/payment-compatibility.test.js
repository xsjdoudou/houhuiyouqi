const assert = require('assert')
const { checkPaymentCompatibility } = require('../miniprogram/utils/payment-compatibility')

function api(platform, version) {
  return {
    requestVirtualPayment() {},
    getSystemInfoSync: () => ({ platform, version })
  }
}

assert.ok(checkPaymentCompatibility({}))
assert.ok(checkPaymentCompatibility({ requestVirtualPayment() {} }))
assert.ok(checkPaymentCompatibility(api('', '8.0.68')))
assert.ok(checkPaymentCompatibility(api('ios', '8.0.67')))
assert.ok(checkPaymentCompatibility(api('ios', 'unknown')))
assert.strictEqual(checkPaymentCompatibility(api('ios', '8.0.68')), '')
assert.strictEqual(checkPaymentCompatibility(api('iOS', '8.1.0')), '')
assert.strictEqual(checkPaymentCompatibility(api('ios', '9.0.0')), '')
assert.strictEqual(checkPaymentCompatibility(api('android', '8.0.1')), '')
console.log('payment compatibility tests passed')
