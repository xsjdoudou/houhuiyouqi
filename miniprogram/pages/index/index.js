const { questions } = require('../../utils/content')
const { checkPaymentCompatibility } = require('../../utils/payment-compatibility')

Page({
  data: {
    view: 'home',
    questions,
    index: 0,
    answers: [],
    selected: -1,
    progress: 0,
    result: null,
    resultKey: '',
    resultVersion: 1,
    recordId: '',
    records: [],
    loading: false,
    historyError: false,
    saveMessage: '',
    shared: false
  },

  onUnload() {
    clearTimeout(this.advanceTimer)
  },

  start() {
    clearTimeout(this.advanceTimer)
    this.advanceTimer = null
    this.setData({ view: 'quiz', index: 0, answers: [], selected: -1, progress: 0, shared: false })
  },

  select(event) {
    if (this.advanceTimer || this.data.loading || this.data.view !== 'quiz') return
    const value = Number(event.currentTarget.dataset.value)
    if (!Number.isInteger(value) || value < 0 || value > 3) return
    this.setData({ selected: value })
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null
      if (this.data.view === 'quiz') this.next()
    }, 200)
  },

  previous() {
    if (this.advanceTimer) return
    const index = this.data.index - 1
    if (index >= 0) this.setData({ index, selected: this.data.answers[index], progress: index / questions.length * 100 })
  },

  async next() {
    if (this.data.selected < 0 || this.data.loading) return
    const answers = this.data.answers.slice()
    answers[this.data.index] = this.data.selected
    if (this.data.index < questions.length - 1) {
      const index = this.data.index + 1
      this.setData({ answers, index, selected: answers[index] === undefined ? -1 : answers[index], progress: index / questions.length * 100 })
      return
    }
    this.setData({ loading: true, saveMessage: '正在保存记录...' })
    try {
      const response = await wx.cloud.callFunction({ name: 'records', data: { action: 'add', answers } })
      if (!response.result || !response.result.ok || !response.result.id) throw new Error('save failed')
      this.setData({ loading: false })
      await this.loadRecord(response.result.id)
    } catch (error) {
      console.error('保存失败', error)
      this.setData({ saveMessage: '', loading: false })
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  async loadRecord(id, recover) {
    this.setData({ loading: true, recordId: id })
    try {
      const response = await wx.cloud.callFunction({ name: 'records', data: { action: 'get', id } })
      let data = response.result
      if (!data || !data.ok) throw new Error('record unavailable')
      if (data.locked && recover) {
        const check = await wx.cloud.callFunction({ name: 'payment', data: { action: 'reconcile', recordId: id } })
        if (!check.result || !check.result.ok) throw new Error('payment status unavailable')
        const retry = await wx.cloud.callFunction({ name: 'records', data: { action: 'get', id } })
        data = retry.result
        if (!data || !data.ok) throw new Error('record unavailable')
      }
      if (data.locked) {
        this.setData({ view: 'locked', result: null, friendship: null, loading: false })
      } else {
        this.setData({ view: 'result', result: data.result, friendship: data.friendship, resultVersion: data.version, shared: false, loading: false })
      }
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '记录加载失败', icon: 'none' })
    }
  },

  refreshPayment() {
    if (!this.data.loading && this.data.recordId) this.loadRecord(this.data.recordId, true)
  },

  async buy(event) {
    if (this.data.loading || !this.data.recordId) return
    const compatibilityError = checkPaymentCompatibility(wx)
    if (compatibilityError) {
      wx.showModal({ title: '暂无法支付', content: compatibilityError, showCancel: false })
      return
    }
    const productId = event.currentTarget.dataset.product
    this.setData({ loading: true })
    try {
      const login = await wx.login()
      const response = await wx.cloud.callFunction({
        name: 'payment',
        data: { action: 'create', recordId: this.data.recordId, productId, loginCode: login.code }
      })
      const order = response.result
      if (!order || !order.ok) {
        if (order && order.code === 'ALREADY_UNLOCKED') {
          this.setData({ loading: false })
          await this.loadRecord(this.data.recordId)
        } else if (order && order.code === 'ORDER_PENDING') {
          wx.showModal({ title: '订单确认中', content: '请先刷新支付状态，避免重复购买。', showCancel: false })
        } else {
          wx.showToast({ title: '支付暂不可用', icon: 'none' })
        }
        return
      }
      try {
        await new Promise((resolve, reject) => wx.requestVirtualPayment(Object.assign({}, order.payData, { success: resolve, fail: reject })))
      } catch (error) {
        // The client callback can be lost after a successful payment.
      }
      this.setData({ loading: false })
      await this.loadRecord(this.data.recordId, true)
      if (this.data.view === 'locked') {
        wx.showModal({ title: '支付状态尚未确认', content: '请先刷新支付状态，避免重复购买。', showCancel: false })
      }
    } catch (error) {
      wx.showToast({ title: '支付未完成，请稍后重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  home() {
    clearTimeout(this.advanceTimer)
    this.advanceTimer = null
    this.setData({ view: 'home', shared: false })
  },

  async history() {
    this.setData({ view: 'history', loading: true, historyError: false, records: [] })
    try {
      const response = await wx.cloud.callFunction({ name: 'records', data: { action: 'list' } })
      if (!response.result || !response.result.ok) throw new Error('list failed')
      const records = response.result.records.map(item => ({
        id: item.id,
        version: item.version === 3 ? 3 : item.version === 2 ? 2 : 1,
        date: new Date(item.createdAt).toLocaleDateString()
      }))
      this.setData({ records, loading: false })
    } catch (error) {
      console.error('读取失败', error)
      this.setData({ loading: false, historyError: true })
      wx.showToast({ title: '记录加载失败', icon: 'none' })
    }
  },

  openRecord(event) {
    this.loadRecord(event.currentTarget.dataset.id, true)
  },

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复，这条记录的单次解锁权益也将无法使用。',
      success: async ({ confirm }) => {
        if (!confirm) return
        try {
          const response = await wx.cloud.callFunction({ name: 'records', data: { action: 'delete', id } })
          if (!response.result || !response.result.ok) throw new Error('delete failed')
          this.setData({ records: this.data.records.filter(item => item.id !== id) })
          wx.showToast({ title: '已删除' })
        } catch (error) {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    return { title: '后会友期，一起发现你的友谊人格', path: '/pages/index/index' }
  }
})
