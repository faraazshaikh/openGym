// The body fat and BMR calculators, opened from Measurements. The maths is lib/body-calc.js.
//
// What you type is kept on this device only (sex, age, height, activity), so the next visit starts
// where you left off. Waist and neck follow the tape-measure unit in Settings and start from your
// latest check-in; weight starts from your latest weigh-in.
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { Button, NumberField, Segmented, SelectRow } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { fmtNum, todayISO } from '../lib/format.js'
import {
  ACTIVITY_LEVELS, DEFAULT_ACTIVITY, bmrResult, cmToFeetInches, feetInchesToCm, navyBodyFat,
} from '../lib/body-calc.js'
import {
  fromMeasurementDisplay, latestMeasurement, lengthKey, logBodyFat, measurementUnit, toMeasurementDisplay,
} from '../lib/measurements.js'

const KEY = 'gym_calc_v1'
const LB_PER_KG = 2.2046226218

const load = () => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
const keep = patch => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })) } catch { /* storage blocked: nothing to keep */ }
}

const latestWeight = S => {
  const rows = (Array.isArray(S.bodyweight) ? S.bodyweight : []).filter(b => b?.d && Number(b.w) > 0)
  if (!rows.length) return null
  return Number(rows.reduce((a, b) => (b.d >= a.d ? b : a)).w)
}
const shown = (S, key) => {
  const m = latestMeasurement(S, key)
  return m ? toMeasurementDisplay(m.value, lengthKey(S), { key }) : null
}

function Field({ label, unit, children }) {
  return <label className="measure-field">
    <span>{label}</span>
    <span className="measure-input">{children}<i>{unit}</i></span>
  </label>
}

// Height in the tape-measure unit: feet and inches, or centimetres.
function HeightField({ inches, cm, onChange }) {
  if (!inches) return <Field label={t('Height')} unit="cm">
    <NumberField nullable value={cm} onChange={v => onChange(v == null || v <= 0 ? null : v)} />
  </Field>
  const { ft, inch } = cm ? cmToFeetInches(cm) : { ft: '', inch: '' }
  return <label className="measure-field">
    <span>{t('Height')}</span>
    <span className="measure-input hgt">
      <NumberField nullable decimal={false} value={cm ? ft : null} aria-label={t('Feet')} onChange={v => onChange(feetInchesToCm(v, inch))} />
      <i>ft</i>
      <NumberField nullable value={cm ? inch : null} aria-label={t('Inches')} onChange={v => onChange(feetInchesToCm(ft, v))} />
      <i>in</i>
    </span>
  </label>
}

// After Calculate the result can sit below the fold of a short phone: bring it into view.
const showResult = () => setTimeout(() => document.querySelector('.calc-result')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 60)

const SEX_OPTIONS = () => [{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]

function BodyFatCalc({ close, forBmr }) {
  const S = useStore(s => s.S)
  const key = lengthKey(S)
  const inches = measurementUnit(key) === 'in'
  const saved = load()
  const [sex, setSex] = useState(saved.sex === 'female' ? 'female' : 'male')
  const [waist, setWaist] = useState(() => shown(S, 'waist'))
  const [neck, setNeck] = useState(() => shown(S, 'neck'))
  const [hip, setHip] = useState(() => shown(S, 'hips'))
  const [height, setHeight] = useState(saved.heightCm > 0 ? saved.heightCm : null)
  const [result, setResult] = useState(null)
  const [saved$, setSaved] = useState(false)
  const cm = v => (v == null || v === '' ? null : fromMeasurementDisplay(v, key))

  const calculate = () => {
    keep({ sex, heightCm: height })
    const pct = navyBodyFat({ sex, waistCm: cm(waist), neckCm: cm(neck), heightCm: height, hipCm: cm(hip) })
    setResult(pct == null ? { error: true } : { pct })
    setSaved(false)
    showResult()
  }
  const save = () => {
    useStore.getState().update(s => { logBodyFat(s, result.pct, todayISO()) })
    setSaved(true)
    useUI.getState().toast(t('Body fat saved to today\'s measurements'))
  }

  return <>
    <h3>{t('Body fat calculator')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('An estimate from a tape measure (the US Navy method). Measure relaxed, at the navel for the waist and below the larynx for the neck.')}</div>
    <div className="calc-form">
      <div><div className="muted small" style={{ margin: '0 2px 6px' }}>{t('Sex')}</div>
        <Segmented options={SEX_OPTIONS()} value={sex} onChange={v => { setSex(v); setResult(null) }} /></div>
      <Field label={t('Waist')} unit={inches ? 'in' : 'cm'}><NumberField nullable value={waist} onChange={setWaist} /></Field>
      <Field label={t('Neck')} unit={inches ? 'in' : 'cm'}><NumberField nullable value={neck} onChange={setNeck} /></Field>
      {sex === 'female' && <Field label={t('Hips')} unit={inches ? 'in' : 'cm'}><NumberField nullable value={hip} onChange={setHip} /></Field>}
      <HeightField inches={inches} cm={height} onChange={setHeight} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={calculate}>{t('Calculate')}</Button>
    {result && <div className="card calc-result" role="status">
      {result.error
        ? <div className="muted small">{t('Those numbers do not give a sensible result. Check the waist, neck and height.')}</div>
        : <>
          <div className="muted small">{t('Estimated body fat')}</div>
          <div className="big" style={{ marginTop: 3 }}>{fmtNum(result.pct)} <span className="muted" style={{ fontSize: 'var(--fs-callout)' }}>%</span></div>
          <div style={{ height: 10 }} />
          <Button onClick={save} disabled={saved$}>{saved$ ? t('Saved') : t('Save to measurements')}</Button>
          {forBmr && <><div style={{ height: 8 }} />
            <Button variant="ghost" onClick={() => { close(); bmrSheet({ fat: result.pct }) }}>{t('Use in the BMR calculator')}</Button></>}
        </>}
    </div>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Close')}</Button>
  </>
}

function BmrCalc({ close, fat: startFat }) {
  const S = useStore(s => s.S)
  const inches = measurementUnit(lengthKey(S)) === 'in'
  const saved = load()
  const [activity, setActivity] = useState(ACTIVITY_LEVELS.some(l => l.value === saved.activity) ? saved.activity : DEFAULT_ACTIVITY)
  const [sex, setSex] = useState(saved.sex === 'female' ? 'female' : 'male')
  const [age, setAge] = useState(saved.age > 0 ? saved.age : null)
  const [weight, setWeight] = useState(() => latestWeight(S))
  const [height, setHeight] = useState(saved.heightCm > 0 ? saved.heightCm : null)
  const [fat, setFat] = useState(() => startFat ?? latestMeasurement(S, 'bodyFat')?.value ?? null)
  const [result, setResult] = useState(null)
  const wUnit = S.unit === 'lb' ? 'lb' : 'kg'

  const calculate = () => {
    keep({ sex, age, heightCm: height, activity })
    const weightKg = weight == null ? null : wUnit === 'lb' ? weight / LB_PER_KG : weight
    const r = bmrResult({ sex, age, weightKg, heightCm: height, fatPct: fat, activity })
    setResult(r || { error: true })
    showResult()
  }

  return <>
    <h3>{t('BMR calculator')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('The energy your body burns at rest, and with your exercise on top.')}</div>
    <div className="calc-form">
      <SelectRow title={t('I exercise')} sheetTitle={t('I exercise')} value={activity} onChange={setActivity}
        options={ACTIVITY_LEVELS.map(l => ({ value: l.value, label: t(l.label) }))} />
      <div><div className="muted small" style={{ margin: '0 2px 6px' }}>{t('Sex')}</div>
        <Segmented options={SEX_OPTIONS()} value={sex} onChange={setSex} /></div>
      <Field label={t('Age')} unit={t('years')}><NumberField nullable decimal={false} value={age} onChange={setAge} /></Field>
      <Field label={t('Weight')} unit={wUnit}><NumberField nullable value={weight} onChange={setWeight} /></Field>
      <HeightField inches={inches} cm={height} onChange={setHeight} />
      <Field label={t('My fat percentage')} unit="%"><NumberField nullable value={fat} onChange={setFat} /></Field>
      <Button variant="ghost" onClick={() => { close(); bodyFatSheet({ forBmr: true }) }}>{t('I don\'t know my fat percentage')}</Button>
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={calculate}>{t('Calculate')}</Button>
    {result && <div className="card calc-result" role="status">
      {result.error
        ? <div className="muted small">{t('Enter your age, weight and height to get a result.')}</div>
        : <>
          <div className="muted small">{t('Resting energy (BMR)')}</div>
          <div className="big" style={{ marginTop: 3 }}>{fmtNum(result.bmr)} <span className="muted" style={{ fontSize: 'var(--fs-callout)' }}>{t('kcal a day')}</span></div>
          <div style={{ height: 10 }} />
          <div className="muted small">{t('With your exercise')}</div>
          <div className="big" style={{ marginTop: 3 }}>{fmtNum(result.daily)} <span className="muted" style={{ fontSize: 'var(--fs-callout)' }}>{t('kcal a day')}</span></div>
          <div className="muted small" style={{ marginTop: 8 }}>{result.formula === 'katch-mcardle'
            ? t('Worked out from your lean mass (Katch-McArdle).')
            : t('Worked out from your age, height and weight (Mifflin-St Jeor).')}</div>
        </>}
    </div>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Close')}</Button>
  </>
}

export function bodyFatSheet({ forBmr = false } = {}) {
  return useUI.getState().openSheet(close => <BodyFatCalc close={close} forBmr={forBmr} />)
}
export function bmrSheet({ fat = null } = {}) {
  return useUI.getState().openSheet(close => <BmrCalc close={close} fat={fat} />)
}
