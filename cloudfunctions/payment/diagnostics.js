function logPayment(stage, details = {}) {
  const entry = { stage }
  if (Number.isSafeInteger(details.errcode)) entry.errcode = details.errcode
  if (Number.isSafeInteger(details.status)) entry.status = details.status
  if (Number.isSafeInteger(details.count)) entry.count = details.count
  console.log('[payment-diagnostic]', JSON.stringify(entry))
}

module.exports = { logPayment }
