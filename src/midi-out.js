/**
 * Optional Web MIDI output of detected note-on/off.
 * Cheap enough for MVP: one channel, no velocity curves.
 */

export function createMidiOut() {
  let access = null
  let output = null
  let lastNote = null
  let enabled = false

  async function init() {
    if (!navigator.requestMIDIAccess) {
      return { ok: false, reason: 'Web MIDI not supported in this browser' }
    }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false })
      const outs = [...access.outputs.values()]
      output = outs[0] || null
      return { ok: true, outputs: outs.map((o) => o.name), selected: output?.name || null }
    } catch (err) {
      return { ok: false, reason: err?.message || String(err) }
    }
  }

  function setEnabled(on) {
    enabled = !!on
    if (!enabled) noteOff()
  }

  function isEnabled() {
    return enabled
  }

  function noteOn(midi, velocity = 90) {
    if (!enabled || !output) return
    const n = Math.max(0, Math.min(127, Math.round(midi)))
    if (lastNote != null && lastNote !== n) {
      output.send([0x80, lastNote, 0])
    }
    if (lastNote !== n) {
      output.send([0x90, n, velocity])
      lastNote = n
    }
  }

  function noteOff() {
    if (!output || lastNote == null) {
      lastNote = null
      return
    }
    output.send([0x80, lastNote, 0])
    lastNote = null
  }

  return { init, setEnabled, isEnabled, noteOn, noteOff }
}
