const assert = require('assert')
const { lockId, reserveOrder } = require('../cloudfunctions/payment/order-reservation')

async function run() {
  const locks = new Map()
  const saved = []
  const deps = {
    clearTerminalLock: async () => {},
    acquire: async lock => {
      if (locks.has(lock._id)) throw new Error('duplicate')
      locks.set(lock._id, lock)
    },
    release: async (id, owner, orderId) => {
      const lock = locks.get(id)
      if (lock && lock.owner === owner && lock.orderId === orderId) locks.delete(id)
    },
    hasAccess: async () => false,
    listPending: async () => [],
    insert: async order => { saved.push(order) }
  }
  const order = { owner: 'owner', orderId: 'T12345678', recordId: 'r1' }
  const results = await Promise.allSettled([
    reserveOrder(order, deps),
    reserveOrder(Object.assign({}, order, { orderId: 'T87654321' }), deps)
  ])
  assert.strictEqual(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.strictEqual(saved.length, 1)
  assert.strictEqual(locks.size, 1)
  let recovered = false
  await assert.rejects(reserveOrder(order, Object.assign({}, deps, {
    clearTerminalLock: async () => { recovered = true },
    acquire: async () => { throw new Error('pending lock') }
  })))
  assert.strictEqual(recovered, true)
  await deps.release(lockId(order.owner), order.owner, saved[0].orderId)
  await assert.rejects(reserveOrder(order, Object.assign({}, deps, { hasAccess: async () => true })))
  assert.strictEqual(locks.size, 0)
  await assert.rejects(reserveOrder(order, Object.assign({}, deps, {
    insert: async () => { throw new Error('write outcome unknown') }
  })))
  assert.strictEqual(locks.size, 1)
  console.log('payment order reservation tests passed')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
