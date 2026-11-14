import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The daily numbers (steps, sleep, resting heart rate) read back from Health Connect for the
// calendar. The native plugin and the app's data directory are played in memory, as in
// health-sync.read.test.js.
const h = vi.hoisted(() => {
  vi.stubEnv('VITE_MOBILE', '1')
  return { files: new Map(), calls: [], platform: 'android', read: { steps: true, sleep: true, restingHeartRate: true, heartRate: true, calories: true }, raw: { steps: [], sleep: [], rhr: [] }, fail: null }
})

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readFile: async ({ path }) => {
      if (!h.files.has(path)) throw new Error('File does not exist')
      return { data: h.files.get(path) }
    },
    writeFile: async ({ path, data }) => { h.files.set(path, data) },
  },
}))
vi.mock('@capacitor/app', () => ({ App: { addListener: () => ({ remove() {} }) } }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => h.platform },
  registerPlugin: () => ({
    status: async () => ({ status: 'available', granted: false, read: { ...h.read } }),
    requestPermissions: async arg => { h.calls.push(['request', arg]); return { granted: false, read: { ...h.read } } },
    readDaily: async arg => {
      h.calls.push(['readDaily', arg])
      if (h.fail) throw Object.assign(new Error('no'), { code: h.fail })
      return { origins: ['com.xiaomi.wearable'], ...h.raw }
    },
    write: async () => {}, remove: async () => {}, openSettings: async () => {}, setEnabled: async () => {},
  }),
}))

// 20:00 on the 15th, on the machine's clock, so the fixture days hold in any time zone.
const NOW = new Date(2026, 9, 15, 20, 0, 0).getTime()
const at = (day, hour) => new Date(day + 'T00:00:00').setHours(hour, 0, 0, 0)
const reads = () => h.calls.filter(c => c[0] === 'readDaily')
const file = () => JSON.parse(h.files.get('opengym-health.json') || 'null')

let hs
const getState = () => ({ unit: 'kg', workouts: [], bodyweight: [] })
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.resetModules()
  h.files.clear(); h.calls = []; h.platform = 'android'; h.read = { steps: true, sleep: true, restingHeartRate: true, heartRate: true, calories: true }; h.fail = null
  h.raw = {
    steps: [[at('2026-10-15', 8), at('2026-10-15', 9), 4200, 0], [at('2026-10-14', 8), at('2026-10-14', 20), 9100, 0]],
    sleep: [{ s: at('2026-10-14', 23), e: at('2026-10-15', 7), o: 0, st: [] }],
    rhr: [[at('2026-10-15', 6), 59, 0]],
  }
  hs = await import('./health-sync.js')
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('daily numbers', () => {
  it('asks for the three permissions, then keeps one entry per day in the health file', async () => {
    const r = await hs.enableRead('daily', getState)
    expect(r.ok).toBe(true)
    expect(h.calls[0]).toEqual(['request', { read: ['steps', 'sleep', 'restingHeartRate', 'heartRate', 'calories'], write: [] }])
    expect(reads()).toHaveLength(1)
    expect(file().daily).toEqual({
      '2026-10-15': { steps: 4200, sleep: 480, rhr: 59 },
      '2026-10-14': { steps: 9100 },
    })
  })

  it('estimates the resting heart rate from the readings when no app saves one', async () => {
    h.raw.rhr = []
    h.raw.hr = Array.from({ length: 30 }, (_, i) => [at('2026-10-15', 1) + i * 10 * 60000, 54 + (i % 30), 0])
    await hs.enableRead('daily', getState)
    expect(file().daily['2026-10-15']).toMatchObject({ rhr: 55, rhrEst: true })
  })

  it('first reads 30 days back, then from the day before the newest kept', async () => {
    await hs.enableRead('daily', getState)
    const first = reads()[0][1].since
    expect(first).toBeLessThanOrEqual(new Date(2026, 8, 15).getTime())
    await hs.readHealth(getState, { force: true, now: NOW + 3 * 60e3 })
    expect(reads()).toHaveLength(2)
    expect(reads()[1][1].since).toBe(new Date(2026, 9, 14).getTime() - 12 * 3600e3)
  })

  it('does not read again within a couple of minutes', async () => {
    await hs.enableRead('daily', getState)
    await hs.readHealth(getState, { force: true, now: NOW + 60e3 })
    expect(reads()).toHaveLength(1)
  })

  it('stays off when none of the permissions was granted', async () => {
    h.read = { steps: false, sleep: false, restingHeartRate: false, heartRate: false, calories: false }
    const r = await hs.enableRead('daily', getState)
    expect(r).toMatchObject({ ok: false, reason: 'denied' })
    expect(reads()).toHaveLength(0)
  })

  it('one permission is enough', async () => {
    h.read = { steps: true, sleep: false, restingHeartRate: false, calories: false }
    const r = await hs.enableRead('daily', getState)
    expect(r.ok).toBe(true)
  })

  it('is not offered on the iPhone', async () => {
    h.platform = 'ios'
    const r = await hs.enableRead('daily', getState)
    expect(r).toEqual({ ok: false, reason: 'unsupported' })
    expect(h.calls).toEqual([])
  })

  it('a withdrawn permission is remembered for Settings', async () => {
    await hs.enableRead('daily', getState)
    h.fail = 'permission'
    await hs.readHealth(getState, { force: true, now: NOW + 3 * 60e3 })
    expect(file().readError).toBe('permission')
  })

  it('turning it off clears the numbers and stops the reads', async () => {
    await hs.enableRead('daily', getState)
    await hs.disableRead('daily')
    expect(file().readDaily).toBe(false)
    expect(file().daily).toEqual({})
    await hs.readHealth(getState, { force: true, now: NOW + 3 * 60e3 })
    expect(reads()).toHaveLength(1)
  })
})
