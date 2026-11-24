function checkPaymentCompatibility(api) {
  if (typeof api.requestVirtualPayment !== 'function') {
    return '当前微信版本不支持虚拟支付，请更新微信后重试。'
  }

  let info
  try {
    info = api.getSystemInfoSync()
  } catch (error) {
    return '无法确认设备信息，请更新微信后重试。'
  }
  if (!info || typeof info.platform !== 'string' || !info.platform) {
    return '无法确认设备信息，请更新微信后重试。'
  }
  if (info.platform.toLowerCase() === 'ios') {
    const match = typeof info.version === 'string' && /^(\d+)\.(\d+)\.(\d+)(?:\D.*)?$/.exec(info.version)
    if (!match) return '无法确认微信版本，请更新微信后重试。'
    const version = match.slice(1).map(Number)
    const minimum = [8, 0, 68]
    for (let i = 0; i < minimum.length; i++) {
      if (version[i] > minimum[i]) break
      if (version[i] < minimum[i]) return 'iOS 微信版本过低，请更新微信后重试。'
    }
  }
  return ''
}

module.exports = { checkPaymentCompatibility }
