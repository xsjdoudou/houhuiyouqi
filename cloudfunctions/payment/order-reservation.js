const crypto = require('crypto')

function lockId(owner) {
  return crypto.createHash('sha256').update(owner, 'utf8').digest('hex')
}

async function reserveOrder(order, deps) {
  const id = lockId(order.owner)
  await deps.clearTerminalLock(id, order.owner)
  // The unique document ID serializes all pending purchases for this user.
  await deps.acquire({ _id: id, owner: order.owner, orderId: order.orderId, createdAt: new Date() })
  let writing = false
  try {
    if (await deps.hasAccess(order.owner, order.recordId)) throw new Error('Already unlocked')
    const pending = await deps.listPending(order.owner, order.recordId)
    if (pending.length) throw new Error('Order pending')
    writing = true
    await deps.insert(order)
  } catch (error) {
    // An uncertain write must keep its lock until an operator reconciles it.
    if (!writing) await deps.release(id, order.owner, order.orderId)
    throw error
  }
}

module.exports = { lockId, reserveOrder }
