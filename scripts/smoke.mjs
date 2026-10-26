/**
 * Offline smoke: note math + YIN on a synthetic sine (no mic).
 * Run: node scripts/smoke.mjs
 */
import {
  midiToName,
  freqToMidi,
  midiToFreq,
  randomMidiInRange,
  isNaturalMidi,
  BASS_DEFAULT,
} from '../src/notes.js'
import { detectPitchYin, createSustainGate } from '../src/pitch.js'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(midiToName(28) === 'E1', 'E1 name')
assert(midiToName(43) === 'G2', 'G2 name')
assert(Math.abs(midiToFreq(69) - 440) < 0.01, 'A4 freq')
assert(Math.round(freqToMidi(440)) === 69, 'A4 midi')
assert(isNaturalMidi(28), 'E1 natural')
assert(isNaturalMidi(29), 'F1 natural')
assert(!isNaturalMidi(30), 'F#1 not natural')

const r = randomMidiInRange(BASS_DEFAULT.min, BASS_DEFAULT.max)
assert(r >= BASS_DEFAULT.min && r <= BASS_DEFAULT.max, 'range')

for (let i = 0; i < 40; i++) {
  const n = randomMidiInRange(28, 55, null, { accidentals: false })
  assert(isNaturalMidi(n), `natural-only pick ${n}`)
  assert(n >= 28 && n <= 55, 'natural-only in range')
}

const sr = 44100
const freq = midiToFreq(28) // E1 ~41.2 Hz
const buf = new Float32Array(4096)
for (let i = 0; i < buf.length; i++) buf[i] = 0.25 * Math.sin((2 * Math.PI * freq * i) / sr)

const detected = detectPitchYin(buf, sr, 40, 500)
assert(detected, 'YIN should detect E1 sine')
assert(Math.abs(detected.freq - freq) < 1.5, `YIN freq ${detected.freq} vs ${freq}`)

const gate = createSustainGate({ sustainMs: 50 })
let stable = false
const t0 = 1000
for (let t = 0; t < 5; t++) {
  const g = gate.push(detected.freq, t0 + t * 20)
  if (g?.stable) stable = true
}
assert(stable, 'sustain gate should lock')

console.log('smoke ok', { detectedHz: detected.freq.toFixed(2), name: midiToName(Math.round(freqToMidi(detected.freq))) })
