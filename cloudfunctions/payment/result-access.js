// The caller must load these records from trusted server-side storage.
function canAccessResult(owner, record, orders) {
  if (typeof owner !== 'string' || !owner || !record ||
      record.owner !== owner || typeof record._id !== 'string' || !record._id ||
      !Array.isArray(orders)) return false

  return orders.some(order => order &&
    order.owner === owner &&
    order.status === 'delivered' &&
    order.revoked === false &&
    (order.productId === 'always' ||
      (order.productId === 'one_time' && order.recordId === record._id)))
}

module.exports = { canAccessResult }
