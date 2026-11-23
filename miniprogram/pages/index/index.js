const { questions, types, friendshipProfiles, friendshipProfilesV3, calculate } = require('../../utils/content')

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
    records: [],
    loading: false,
    historyError: false,
    saveMessage: '',
    shared: false
  },

  onLoad(options) {
    if (options.type && types[options.type]) {
      this.showResult(options.type, true, options.v === '3' ? 3 : options.v === '2' ? 2 : 1)
    }
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
    const key = calculate(answers)
    this.showResult(key, false, 3)
    this.setData({ loading: true, saveMessage: '正在保存记录...' })
    try {
      const response = await wx.cloud.callFunction({ name: 'records', data: { action: 'add', answers } })
      if (!response.result || !response.result.ok) throw new Error('save failed')
      if (response.result.version !== 3 || response.result.type !== key) {
        this.setData({ saveMessage: '云函数版本不一致，请重新部署 records 后重新测试', loading: false })
        return
      }
      this.setData({ saveMessage: '已保存到我的记录', loading: false })
    } catch (error) {
      console.error('保存失败', error)
      this.setData({ saveMessage: '保存失败，请检查云开发和云函数配置', loading: false })
    }
  },

  showResult(key, shared, version) {
    const friendship = version === 3 ? friendshipProfilesV3[key] : version === 2 ? friendshipProfiles[key] : null
    const result = friendship && friendship.tag ? { ...types[key], tag: friendship.tag } : types[key]
    this.setData({ view: 'result', result, friendship: friendship || null, resultKey: key, resultVersion: friendship ? version : 1, shared, saveMessage: '' })
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
      const records = response.result.records.filter(item => types[item.type]).map(item => ({
        id: item._id,
        type: item.type,
        version: item.version === 3 ? 3 : item.version === 2 ? 2 : 1,
        name: types[item.type].name,
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
    const key = event.currentTarget.dataset.type
    const version = Number(event.currentTarget.dataset.version)
    if (types[key]) this.showResult(key, false, version)
  },

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复。',
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
    const key = this.data.resultKey
    if (this.data.view === 'result' && types[key]) {
      return this.data.resultVersion >= 2
        ? { title: `我和${types[key].name}可能成为好朋友，你会和谁成为好朋友？`, path: `/pages/index/index?type=${key}&v=${this.data.resultVersion}` }
        : { title: `我的相处方式像${types[key].name}，来看看你像谁`, path: `/pages/index/index?type=${key}` }
    }
    return { title: '后会友期，一起发现你的友谊人格', path: '/pages/index/index' }
  }
})
