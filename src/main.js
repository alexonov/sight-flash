import './style.css'
import {
  BASS_DEFAULT,
  TREBLE_DEFAULT,
  buildNoteOptions,
  midiToName,
  randomMidiInRange,
  centsOff,
} from './notes.js'
import { detectPitchYin, createSustainGate } from './pitch.js'
import { renderStaff } from './staff.js'
import { createMidiOut } from './midi-out.js'

const SUSTAIN_MS = 220
const MATCH_CENTS = 50
const BUFFER_SIZE = 2048
const PREFS_KEY = 'sight-flash-prefs'

const els = {
  staff: document.getElementById('staff'),
  noteName: document.getElementById('noteName'),
  listenState: document.getElementById('listenState'),
  detectedPitch: document.getElementById('detectedPitch'),
  score: document.getElementById('score'),
  streak: document.getElementById('streak'),
  tried: document.getElementById('tried'),
  stage: document.getElementById('stage'),
  clef: document.getElementById('clef'),
  rangeMin: document.getElementById('rangeMin'),
  rangeMax: document.getElementById('rangeMax'),
  device: document.getElementById('device'),
  startStop: document.getElementById('startStop'),
  refreshDevices: document.getElementById('refreshDevices'),
  toggleMidi: document.getElementById('toggleMidi'),
  resetScore: document.getElementById('resetScore'),
  accidentals: document.getElementById('accidentals'),
  accidentalsHint: document.getElementById('accidentalsHint'),
  showNames: document.getElementById('showNames'),
}

const state = {
  running: false,
  targetMidi: null,
  score: 0,
  streak: 0,
  tried: 0,
  stream: null,
  audioCtx: null,
  analyser: null,
  source: null,
  raf: 0,
  judging: false,
}

const gate = createSustainGate({ sustainMs: SUSTAIN_MS, centsTolerance: 55 })
const midiOut = createMidiOut()
const floatBuf = new Float32Array(BUFFER_SIZE)

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const p = JSON.parse(raw)
    if (typeof p.accidentals === 'boolean') els.accidentals.checked = p.accidentals
    if (p.showNames === 'always' || p.showNames === 'after') els.showNames.value = p.showNames
  } catch {
    /* ignore corrupt prefs */
  }
  syncAccidentalsHint()
}

function savePrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        accidentals: els.accidentals.checked,
        showNames: els.showNames.value,
      }),
    )
  } catch {
    /* private mode / quota */
  }
}

function syncAccidentalsHint() {
  els.accidentalsHint.textContent = els.accidentals.checked
    ? 'on — include ♯/♭'
    : 'off — naturals only'
}

function showNoteName(text) {
  els.noteName.textContent = text
  els.noteName.hidden = false
}

function hideNoteNameUntilAttempt() {
  if (els.showNames.value === 'after') {
    els.noteName.textContent = ''
    els.noteName.hidden = true
  }
}

function revealNoteNameAfterAttempt() {
  if (state.targetMidi == null) return
  showNoteName(midiToName(state.targetMidi))
}

function fillRangeSelects() {
  const opts = buildNoteOptions(24, 84)
  for (const sel of [els.rangeMin, els.rangeMax]) {
    sel.innerHTML = ''
    for (const o of opts) {
      const opt = document.createElement('option')
      opt.value = String(o.midi)
      opt.textContent = o.label
      sel.appendChild(opt)
    }
  }
  applyClefDefaults()
}

function applyClefDefaults() {
  const def = els.clef.value === 'bass' ? BASS_DEFAULT : TREBLE_DEFAULT
  els.rangeMin.value = String(def.min)
  els.rangeMax.value = String(def.max)
}

function currentRange() {
  let min = Number(els.rangeMin.value)
  let max = Number(els.rangeMax.value)
  if (min > max) [min, max] = [max, min]
  return { min, max }
}

function setFlash(kind) {
  els.stage.dataset.flash = kind || ''
  if (kind) {
    window.setTimeout(() => {
      if (els.stage.dataset.flash === kind) els.stage.dataset.flash = ''
    }, 380)
  }
}

function nextNote() {
  const { min, max } = currentRange()
  state.targetMidi = randomMidiInRange(min, max, state.targetMidi, {
    accidentals: els.accidentals.checked,
  })
  state.judging = true
  gate.reset()
  midiOut.noteOff()
  renderStaff(els.staff, { midi: state.targetMidi, clef: els.clef.value })
  if (els.showNames.value === 'always') {
    showNoteName(midiToName(state.targetMidi))
  } else {
    hideNoteNameUntilAttempt()
  }
  els.listenState.textContent = 'listening…'
  els.listenState.dataset.state = 'listening'
}

function updateScoreboard() {
  els.score.textContent = String(state.score)
  els.streak.textContent = String(state.streak)
  els.tried.textContent = String(state.tried)
}

function resetScoreboard() {
  state.score = 0
  state.streak = 0
  state.tried = 0
  updateScoreboard()
}

async function listDevices() {
  // Need a permission probe so labels (e.g. "HX Stomp") appear on macOS/Chrome
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
    probe.getTracks().forEach((t) => t.stop())
  } catch {
    // Permission may already be denied; still try enumerate
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  const inputs = devices.filter((d) => d.kind === 'audioinput')
  const prev = els.device.value
  els.device.innerHTML = ''
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = inputs.length ? 'System default' : 'No inputs found — grant mic permission'
  els.device.appendChild(placeholder)
  for (const d of inputs) {
    const opt = document.createElement('option')
    opt.value = d.deviceId
    opt.textContent = d.label || `Input ${d.deviceId.slice(0, 8)}`
    els.device.appendChild(opt)
  }
  if (prev && [...els.device.options].some((o) => o.value === prev)) {
    els.device.value = prev
  } else {
    // Prefer HX Stomp if present
    const hx = inputs.find((d) => /hx|stomp|helix/i.test(d.label || ''))
    if (hx) els.device.value = hx.deviceId
  }
}

async function startSession() {
  if (state.running) return
  const constraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(els.device.value ? { deviceId: { exact: els.device.value } } : {}),
    },
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia(constraints)
  } catch (err) {
    els.listenState.textContent = 'mic blocked'
    els.listenState.dataset.state = 'error'
    alert(
      `Could not open audio input.\n\n${err.message}\n\nTips:\n• Allow microphone permission\n• Use localhost or HTTPS\n• Close Bitwig / HX Edit exclusive access\n• Pick HX Stomp in the device list`,
    )
    return
  }

  state.audioCtx = new AudioContext()
  await state.audioCtx.resume()
  state.source = state.audioCtx.createMediaStreamSource(state.stream)
  state.analyser = state.audioCtx.createAnalyser()
  state.analyser.fftSize = BUFFER_SIZE * 2
  state.source.connect(state.analyser)
  // No destination connect — silent monitoring

  state.running = true
  resetScoreboard()
  els.startStop.textContent = 'Stop'
  els.startStop.classList.add('stop')
  ;[els.clef, els.rangeMin, els.rangeMax, els.device].forEach((el) => {
    el.disabled = true
  })

  nextNote()
  loop()
}

function stopSession() {
  state.running = false
  state.judging = false
  cancelAnimationFrame(state.raf)
  midiOut.noteOff()
  if (state.source) {
    try {
      state.source.disconnect()
    } catch {
      /* ignore */
    }
  }
  if (state.audioCtx) {
    state.audioCtx.close().catch(() => {})
  }
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop())
  }
  state.stream = null
  state.audioCtx = null
  state.analyser = null
  state.source = null
  els.startStop.textContent = 'Start'
  els.startStop.classList.remove('stop')
  els.listenState.textContent = 'idle'
  els.listenState.dataset.state = 'idle'
  els.detectedPitch.textContent = 'detected: —'
  ;[els.clef, els.rangeMin, els.rangeMax, els.device].forEach((el) => {
    el.disabled = false
  })
  renderStaff(els.staff, { midi: null, clef: els.clef.value })
  showNoteName('—')
}

function loop() {
  if (!state.running || !state.analyser) return
  state.analyser.getFloatTimeDomainData(floatBuf)
  const result = detectPitchYin(floatBuf, state.audioCtx.sampleRate, 40, 500)

  if (result) {
    const gated = gate.push(result.freq)
    const name = gated ? midiToName(gated.midi) : '—'
    const hz = result.freq.toFixed(1)
    els.detectedPitch.textContent = `detected: ${name} (${hz} Hz)`
    if (gated?.stable) {
      midiOut.noteOn(gated.midi)
      if (state.judging && state.targetMidi != null) {
        const cents = Math.abs(centsOff(result.freq, state.targetMidi))
        const ok = gated.midi === state.targetMidi || cents <= MATCH_CENTS
        judge(ok)
      }
    }
  } else {
    els.detectedPitch.textContent = 'detected: —'
    gate.push(null)
    midiOut.noteOff()
  }

  state.raf = requestAnimationFrame(loop)
}

function judge(ok) {
  state.judging = false
  state.tried += 1
  if (ok) {
    state.score += 1
    state.streak += 1
    setFlash('good')
    els.listenState.textContent = 'correct'
    els.listenState.dataset.state = 'good'
  } else {
    state.streak = 0
    setFlash('bad')
    els.listenState.textContent = 'miss'
    els.listenState.dataset.state = 'bad'
  }
  revealNoteNameAfterAttempt()
  updateScoreboard()
  window.setTimeout(() => {
    if (state.running) nextNote()
  }, 450)
}

els.startStop.addEventListener('click', () => {
  if (state.running) stopSession()
  else startSession()
})

els.refreshDevices.addEventListener('click', () => {
  listDevices().catch((e) => console.warn(e))
})

els.resetScore.addEventListener('click', () => {
  if (state.score === 0 && state.streak === 0 && state.tried === 0) return
  const ok = window.confirm('Clear score, streak, and tried?')
  if (!ok) return
  resetScoreboard()
})

els.clef.addEventListener('change', () => {
  applyClefDefaults()
  renderStaff(els.staff, { midi: null, clef: els.clef.value })
})

els.accidentals.addEventListener('change', () => {
  syncAccidentalsHint()
  savePrefs()
})

els.showNames.addEventListener('change', () => {
  savePrefs()
  if (!state.running) {
    showNoteName(els.noteName.textContent || '—')
    return
  }
  if (els.showNames.value === 'always' && state.targetMidi != null) {
    showNoteName(midiToName(state.targetMidi))
  } else if (state.judging) {
    hideNoteNameUntilAttempt()
  }
})

els.toggleMidi.addEventListener('click', async () => {
  if (!midiOut.isEnabled()) {
    const res = await midiOut.init()
    if (!res.ok) {
      alert(`Web MIDI unavailable: ${res.reason}`)
      return
    }
    midiOut.setEnabled(true)
    els.toggleMidi.textContent = `MIDI out: ${res.selected || 'on'}`
    els.toggleMidi.classList.add('on')
  } else {
    midiOut.setEnabled(false)
    els.toggleMidi.textContent = 'MIDI out: off'
    els.toggleMidi.classList.remove('on')
  }
})

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    listDevices().catch(() => {})
  })
}

loadPrefs()
fillRangeSelects()
renderStaff(els.staff, { midi: null, clef: 'bass' })
listDevices().catch(() => {})
