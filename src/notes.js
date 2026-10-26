/** MIDI note helpers for sight-reading flash cards. */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** Bass DI friendly default: open E string through G above the staff. */
export const BASS_DEFAULT = { min: 28, max: 55 } // E1–G3
export const TREBLE_DEFAULT = { min: 48, max: 72 } // C3–C5

export function midiToName(midi) {
  const n = Math.round(midi)
  const name = NAMES[((n % 12) + 12) % 12]
  const octave = Math.floor(n / 12) - 1
  return `${name}${octave}`
}

export function freqToMidi(freq) {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** Semitone distance; 0 = exact pitch class+octave match within cents. */
export function centsOff(freq, targetMidi) {
  const played = freqToMidi(freq)
  return (played - targetMidi) * 100
}

export function buildNoteOptions(lo = 24, hi = 84) {
  const out = []
  for (let m = lo; m <= hi; m++) {
    out.push({ midi: m, label: midiToName(m) })
  }
  return out
}

/** Pitch classes without sharps/flats: C D E F G A B */
const NATURAL_PC = new Set([0, 2, 4, 5, 7, 9, 11])

export function isNaturalMidi(midi) {
  return NATURAL_PC.has(((Math.round(midi) % 12) + 12) % 12)
}

/**
 * Pick a random MIDI in [min, max].
 * @param {number} min
 * @param {number} max
 * @param {number|null|undefined} exclude  Prefer not repeating this MIDI
 * @param {{ accidentals?: boolean }} [opts]  accidentals:false → naturals only
 */
export function randomMidiInRange(min, max, exclude, opts = {}) {
  const accidentals = opts.accidentals !== false
  const a = Math.min(min, max)
  const b = Math.max(min, max)
  const pool = []
  for (let m = a; m <= b; m++) {
    if (accidentals || isNaturalMidi(m)) pool.push(m)
  }
  if (pool.length === 0) return a
  if (pool.length === 1) return pool[0]
  let next = pool[0]
  for (let i = 0; i < 12; i++) {
    next = pool[Math.floor(Math.random() * pool.length)]
    if (next !== exclude) return next
  }
  return next
}

/**
 * Staff position: diatonic steps from middle C (MIDI 60) = 0.
 * Sharps are drawn on the natural line/space with an accidental.
 */
export function staffStepsFromMidi(midi) {
  const n = Math.round(midi)
  const pc = ((n % 12) + 12) % 12
  const octave = Math.floor(n / 12) - 1
  // natural pitch-class → diatonic letter index (C=0 … B=6)
  const naturalIndex = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc]
  const isSharp = [1, 3, 6, 8, 10].includes(pc)
  const stepsFromC0 = octave * 7 + naturalIndex
  const stepsFromMiddleC = stepsFromC0 - 4 * 7 // C4 = middle C
  return { steps: stepsFromMiddleC, sharp: isSharp }
}
