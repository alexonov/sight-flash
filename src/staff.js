import { staffStepsFromMidi, midiToName } from './notes.js'

/**
 * Draw a single flash-card note on a five-line staff.
 * Bass clef: middle line ≈ D3 (MIDI 50). Treble: B4 (MIDI 71) sits on middle line.
 * We place by diatonic steps from middle C, then offset for clef.
 */

const LINE_GAP = 14
const STAFF_TOP = 60
const NOTE_X = 360

function yForSteps(steps, clef) {
  // Treble: middle C is one ledger below the staff (step 0 → below line 5)
  // Bass: middle C is one ledger above the staff
  // Staff lines in treble (bottom→top): E4 F4 G4 A4 B4  → steps -2,-1,0,1,2 relative? 
  // Using: treble bottom line E4 = steps from middle C: E4 is +2 diatonic from C4? 
  // C D E = 0,1,2 → E4 = +2. Bottom line y = STAFF_TOP + 4*LINE_GAP
  // Each step up decreases y by LINE_GAP/2
  const bottomLineSteps = clef === 'bass' ? -10 : 2 // bass bottom = G2 (−10 from C4), treble bottom = E4 (+2)
  const bottomY = STAFF_TOP + 4 * LINE_GAP
  return bottomY - ((steps - bottomLineSteps) * LINE_GAP) / 2
}

function clefGlyph(clef) {
  // Unicode musical symbols as fallback-friendly text in SVG
  return clef === 'bass' ? '𝄢' : '𝄞'
}

export function renderStaff(svg, { midi, clef }) {
  const ns = 'http://www.w3.org/2000/svg'
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const bg = document.createElementNS(ns, 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '0')
  bg.setAttribute('width', '640')
  bg.setAttribute('height', '220')
  bg.setAttribute('fill', 'transparent')
  svg.appendChild(bg)

  // Staff lines
  for (let i = 0; i < 5; i++) {
    const y = STAFF_TOP + i * LINE_GAP
    const line = document.createElementNS(ns, 'line')
    line.setAttribute('x1', '80')
    line.setAttribute('x2', '560')
    line.setAttribute('y1', String(y))
    line.setAttribute('y2', String(y))
    line.setAttribute('stroke', 'currentColor')
    line.setAttribute('stroke-width', '2')
    svg.appendChild(line)
  }

  // Clef
  const clefText = document.createElementNS(ns, 'text')
  clefText.setAttribute('x', clef === 'bass' ? '95' : '88')
  clefText.setAttribute('y', clef === 'bass' ? String(STAFF_TOP + 3.15 * LINE_GAP) : String(STAFF_TOP + 3.4 * LINE_GAP))
  clefText.setAttribute('font-size', clef === 'bass' ? '72' : '96')
  clefText.setAttribute('fill', 'currentColor')
  clefText.setAttribute('font-family', 'serif')
  clefText.textContent = clefGlyph(clef)
  svg.appendChild(clefText)

  if (midi == null) return

  const { steps, sharp } = staffStepsFromMidi(midi)
  const cy = yForSteps(steps, clef)

  // Ledger lines
  const bottomY = STAFF_TOP + 4 * LINE_GAP
  const topY = STAFF_TOP
  if (cy > bottomY) {
    for (let y = bottomY + LINE_GAP; y <= cy + 0.5; y += LINE_GAP) {
      addLedger(svg, ns, NOTE_X, y)
    }
  }
  if (cy < topY) {
    for (let y = topY - LINE_GAP; y >= cy - 0.5; y -= LINE_GAP) {
      addLedger(svg, ns, NOTE_X, y)
    }
  }

  // Accidental
  if (sharp) {
    const acc = document.createElementNS(ns, 'text')
    acc.setAttribute('x', String(NOTE_X - 38))
    acc.setAttribute('y', String(cy + 8))
    acc.setAttribute('font-size', '36')
    acc.setAttribute('fill', 'currentColor')
    acc.setAttribute('font-family', 'serif')
    acc.textContent = '♯'
    svg.appendChild(acc)
  }

  // Note head (oval)
  const head = document.createElementNS(ns, 'ellipse')
  head.setAttribute('cx', String(NOTE_X))
  head.setAttribute('cy', String(cy))
  head.setAttribute('rx', '11')
  head.setAttribute('ry', '8')
  head.setAttribute('transform', `rotate(-18 ${NOTE_X} ${cy})`)
  head.setAttribute('fill', 'currentColor')
  svg.appendChild(head)

  // Stem
  const stemUp = cy >= STAFF_TOP + 2 * LINE_GAP
  const stem = document.createElementNS(ns, 'line')
  const stemX = stemUp ? NOTE_X + 10 : NOTE_X - 10
  stem.setAttribute('x1', String(stemX))
  stem.setAttribute('x2', String(stemX))
  stem.setAttribute('y1', String(cy))
  stem.setAttribute('y2', String(stemUp ? cy - 48 : cy + 48))
  stem.setAttribute('stroke', 'currentColor')
  stem.setAttribute('stroke-width', '2.5')
  svg.appendChild(stem)

  svg.setAttribute('aria-label', `${clef} clef, ${midiToName(midi)}`)
}

function addLedger(svg, ns, x, y) {
  const line = document.createElementNS(ns, 'line')
  line.setAttribute('x1', String(x - 18))
  line.setAttribute('x2', String(x + 18))
  line.setAttribute('y1', String(y))
  line.setAttribute('y2', String(y))
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '2')
  svg.appendChild(line)
}
