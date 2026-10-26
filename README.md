# Sight Flash

Bass-first sight-reading flash coach: one note on a staff, play it into your audio interface, get scored.

No login. No backend. Web Audio pitch detection (YIN) with a ~220 ms sustain window so bass DI is less twitchy.

## Run

```bash
git clone https://github.com/alexonov/sight-flash.git
cd sight-flash
npm install
npm run dev
```

Leave that terminal open. Open the printed URL (usually `http://127.0.0.1:5173`). Mic access needs **localhost** or **HTTPS** — plain `file://` will not get a reliable device list.

If you copied this folder from the Cursor Agent Store instead of cloning, use the same `npm install` / `npm run dev` from that copy. Copy **out** of a read-only or symlink-restricted mount first if `npm install` fails with `EPERM`.

`ERR_CONNECTION_REFUSED` means Vite isn’t running on your machine — start `npm run dev` locally; a server on a cloud agent does not bind your Mac’s `127.0.0.1`.

### Pick HX Stomp

1. Plug in **HX Stomp** (USB).
2. Quit or disable exclusive mode in **Bitwig** / **HX Edit** if the device is locked.
3. In the app, click **Refresh devices**.
4. Choose **HX Stomp** (or your interface) in **Input device**.
5. Grant microphone permission when the browser asks.

### Two-minute first session

1. Leave **Clef** on **Bass**, range around **E1–G3** (defaults).
2. Hit **Start**.
3. Play the shown note into the Stomp DI / input the browser is hearing.
4. Hold ~¼ second — green flash = correct, red = miss; next note appears.
5. Watch **score / streak** and the **detected** readout if something feels off (wrong device, exclusive audio, too quiet).

### Controls

| Control | What it does |
| --- | --- |
| **Sharps & flats** | On: include ♯/♭ in the random pool (default). Off: naturals only in the chosen range. |
| **Note names** | **Always show** the letter under the staff, or **Only after attempt** (hidden until correct/miss feedback). |
| **Reset score** | Clears score / streak / tried (asks to confirm). Does not stop the session. |
| **MIDI out** | Optional Web MIDI note-on/off of the detected pitch (Chrome). Off by default. |

Sharps/flats and note-name prefs are saved in `localStorage` (`sight-flash-prefs`).

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the build |
| `node scripts/smoke.mjs` | Offline pitch/note smoke (no mic) |

## Stack

Vite + vanilla JS. Pitch → MIDI note for judging is built in. Optional Web MIDI output is included and off by default.

## Honest limits

- Monophonic detection only.
- One flash-card note at a time (no scrolling scores).
- Browser pitch tracking is “good enough,” not a tuner lab.

## License

MIT — see [LICENSE](./LICENSE).
