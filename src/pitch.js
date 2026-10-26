/**
 * Lightweight YIN pitch detector for bass DI.
 * Tuned for ~40–400 Hz fundamentals with a sustain gate.
 */

const YIN_THRESHOLD = 0.12

export function detectPitchYin(buffer, sampleRate, minHz = 40, maxHz = 500) {
  const size = buffer.length
  if (size < 512) return null

  const maxPeriod = Math.floor(sampleRate / minHz)
  const minPeriod = Math.max(2, Math.floor(sampleRate / maxHz))
  const yinSize = Math.min(Math.floor(size / 2), maxPeriod)
  if (yinSize <= minPeriod + 2) return null

  const yin = new Float32Array(yinSize)
  yin[0] = 1

  // Difference function
  for (let tau = 1; tau < yinSize; tau++) {
    let sum = 0
    for (let i = 0; i < yinSize; i++) {
      const delta = buffer[i] - buffer[i + tau]
      sum += delta * delta
    }
    yin[tau] = sum
  }

  // Cumulative mean normalized difference
  let running = 0
  for (let tau = 1; tau < yinSize; tau++) {
    running += yin[tau]
    yin[tau] = running > 0 ? (yin[tau] * tau) / running : 1
  }

  let tauEstimate = -1
  for (let tau = minPeriod; tau < yinSize; tau++) {
    if (yin[tau] < YIN_THRESHOLD) {
      while (tau + 1 < yinSize && yin[tau + 1] < yin[tau]) tau++
      tauEstimate = tau
      break
    }
  }
  if (tauEstimate < 0) return null

  // Parabolic interpolation
  const x0 = tauEstimate > 0 ? tauEstimate - 1 : tauEstimate
  const x2 = tauEstimate + 1 < yinSize ? tauEstimate + 1 : tauEstimate
  let betterTau = tauEstimate
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = yin[x0]
    const s1 = yin[tauEstimate]
    const s2 = yin[x2]
    const denom = 2 * (2 * s1 - s2 - s0)
    if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom
  }

  const freq = sampleRate / betterTau
  if (freq < minHz || freq > maxHz) return null

  // RMS gate — ignore silence / cable noise
  let energy = 0
  for (let i = 0; i < size; i++) energy += buffer[i] * buffer[i]
  const rms = Math.sqrt(energy / size)
  if (rms < 0.008) return null

  return { freq, rms, confidence: 1 - yin[tauEstimate] }
}

/**
 * Require the same MIDI note for `sustainMs` before accepting.
 * Bass DI false-triggers less with 150–300ms.
 */
export function createSustainGate({ sustainMs = 220, centsTolerance = 45 } = {}) {
  let heldMidi = null
  let heldSince = 0

  return {
    reset() {
      heldMidi = null
      heldSince = 0
    },
    /**
     * @returns {{ midi: number, freq: number, stable: boolean } | null}
     */
    push(freq, now = performance.now()) {
      if (!freq) {
        heldMidi = null
        heldSince = 0
        return null
      }
      const midiFloat = 69 + 12 * Math.log2(freq / 440)
      const midi = Math.round(midiFloat)
      const cents = (midiFloat - midi) * 100
      if (Math.abs(cents) > centsTolerance) {
        // In between notes — keep waiting on previous if close enough later
        return { midi, freq, stable: false, cents }
      }
      if (heldMidi === midi) {
        const stable = now - heldSince >= sustainMs
        return { midi, freq, stable, cents }
      }
      heldMidi = midi
      heldSince = now
      return { midi, freq, stable: false, cents }
    },
  }
}
