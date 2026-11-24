const assert = require('assert')
const { canAccessResult } = require('../cloudfunctions/payment/result-access')

const record = { _id: 'record1', owner: 'user1' }
const oneTime = {
  owner: 'user1', status: 'delivered', revoked: false,
  productId: 'one_time', recordId: 'record1'
}
const permanent = {
  owner: 'user1', status: 'delivered', revoked: false, productId: 'always'
}

assert.strictEqual(canAccessResult('user1', record, [oneTime]), true)
assert.strictEqual(canAccessResult('user1', record, [permanent]), true)
assert.strictEqual(canAccessResult('user1', { _id: 'record2', owner: 'user1' }, [oneTime]), false)
assert.strictEqual(canAccessResult('user1', { _id: 'record2', owner: 'user1' }, [permanent]), true)
assert.strictEqual(canAccessResult('user2', record, [permanent]), false)
assert.strictEqual(canAccessResult('user1', record, [Object.assign({}, oneTime, { owner: 'user2' })]), false)
assert.strictEqual(canAccessResult('user1', record, [Object.assign({}, oneTime, { status: 'pending' })]), false)
assert.strictEqual(canAccessResult('user1', record, [Object.assign({}, permanent, { revoked: true })]), false)
assert.strictEqual(canAccessResult('user1', record, [Object.assign({}, permanent, { revoked: undefined })]), false)
assert.strictEqual(canAccessResult('user1', record, [{ owner: 'user1', status: 'delivered', revoked: false, productId: 'other' }]), false)
assert.strictEqual(canAccessResult('user1', record, []), false)
assert.strictEqual(canAccessResult('user1', null, [permanent]), false)

console.log('payment result access tests passed')
