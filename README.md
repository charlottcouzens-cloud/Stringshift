# Stringshift

A guitar-to-mandolin tab workspace built with React and Vinext.

## Use

Paste six consecutive ASCII tab lines, high string first. All six lines in a block must have equal widths and aligned bar lines. Select the guitar tuning, capo, transposition, and mandolin fret limit, then convert. Custom tuning uses scientific pitch notation, low to high (for example `E2 A2 D3 G3 B3 E4`).

The generated mandolin tab uses E5, A4, D4, G3 from top to bottom. Playback uses a paired-voice Web Audio synth with adjustable tempo and notes per beat. Save as PDF opens the browser print dialog and prints only the arrangement, title, and settings. Conversion happens in the browser; tab text is not uploaded or saved.

## Musical limitations

ASCII spacing is not a reliable rhythm encoding. Playback uses evenly spaced note positions, without inferred rests. Technique symbols and repeats are not reproduced. Out-of-range notes can be octave-folded. Unisons are combined; chord tones that cannot occupy separate courses are omitted with a warning. Wide stretches are flagged. This is an arrangement aid, not a guarantee of playable fingering.

## Development and validation

Use Node.js 22.13 or later. Run `npm install`, then `npm run dev`. Run `npm run build` for production and `npx tsc --noEmit` for type checking.

Conversion tests: `node --experimental-strip-types --test tests/conversion.test.mjs`.

The tests cover known pitches, octave fitting, strict range handling, custom tuning, capo and transposition, multi-digit frets, chords, multiple blocks, unsupported inputs, and technique warnings. Type checking and production compilation were also run. No browser interaction or visual QA was requested. Audio output and the system print dialog require browser-level verification.

The optional `convert_guitar_tab` WebMCP tool uses the same converter and updates the visible editors. Registration is feature-detected. No supported WebMCP validation context was available during implementation, so its live contract remains unverified.

On Windows without Bash, the publishing archive can be staged using the Sites packager's `prepare-site-build.cjs` helper, followed by copying the hosting manifest into the staged `.openai` directory and archiving the staged `dist` with Windows `tar.exe`.
