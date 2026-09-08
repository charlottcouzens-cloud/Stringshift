export const EXAMPLE = `e|--------------------------|--------------------------|
B|--------------------------|--------------------------|
G|-----0--2--4--2--0--------|-----0--2--4--7--4--2--0--|
D|--5----------------5--2---|--5-----------------------|
A|--------------------------|--------------------------|
E|--------------------------|--------------------------|`;
export const TUNINGS: Record<string, string> = {
  standard: 'E2 A2 D3 G3 B3 E4',
  dropD: 'D2 A2 D3 G3 B3 E4',
  dadgad: 'D2 A2 D3 G3 A3 D4',
  openG: 'D2 G2 D3 G3 B3 D4',
};
export const MANDOLIN = [76, 69, 62, 55]; // E5 A4 D4 G3, displayed high to low.
export type Options = { tuning: string; shift: number; capo: number; fold: boolean; maxFret: number };
export const DEFAULT_OPTIONS: Options = { tuning: TUNINGS.standard, shift: 0, capo: 0, fold: true, maxFret: 19 };
export type Note = { string: number; fret: number; pitch: number };
export type Conversion = { text: string; blocks: string[]; events: Note[][]; warnings: string[]; notes: number; options: Options };

export function parseTuning(value: string): number[] {
  const parts = value.trim().split(/[\s,]+/);
  if (parts.length !== 6) throw new Error('Enter six tuning notes from low to high, with octaves: E2 A2 D3 G3 B3 E4.');
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return parts.map(part => {
    const m = /^([A-Ga-g])([#b]?)([0-8])$/.exec(part);
    if (!m) throw new Error(`Invalid tuning note “${part}”. Use a note and octave, such as F#2 or Bb3.`);
    const pitch = (Number(m[3]) + 1) * 12 + natural[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    if (pitch < 24 || pitch > 88) throw new Error('Guitar tuning notes must be between C1 and E6.');
    return pitch;
  }).reverse();
}

function assign(pitches: number[], maxFret: number): { notes: Note[]; dropped: number } {
  // Search possible courses instead of putting simultaneous notes on one course.
  const unique = [...new Set(pitches)].sort((a, b) => b - a);
  let best: Note[] = [], bestScore = Infinity;
  function visit(i: number, notes: Note[], mask: number, cost: number) {
    if (i === unique.length) {
      const fretted = notes.filter(n => n.fret > 0).map(n => n.fret);
      const span = fretted.length > 1 ? Math.max(...fretted) - Math.min(...fretted) : 0;
      const score = (unique.length - notes.length) * 10000 + cost + span * 8;
      if (score < bestScore) { bestScore = score; best = [...notes]; }
      return;
    }
    for (let s = 0; s < 4; s++) {
      const fret = unique[i] - MANDOLIN[s];
      if (!(mask & (1 << s)) && fret >= 0 && fret <= maxFret) {
        notes.push({ string: s, fret, pitch: unique[i] });
        visit(i + 1, notes, mask | (1 << s), cost + fret);
        notes.pop();
      }
    }
    // Prefer retaining the highest melody note when a chord must be simplified.
    visit(i + 1, notes, mask, cost + unique.length - i);
  }
  visit(0, [], 0, 0);
  return { notes: best, dropped: unique.length - best.length };
}

export function convertTab(source: string, options: Options = DEFAULT_OPTIONS): Conversion {
  if (!source.trim()) throw new Error('Paste a guitar tab first, or load the example.');
  if (source.length > 100000) throw new Error('This tab is too long. Convert a section of up to 100,000 characters at a time.');
  if (!Number.isInteger(options.shift) || Math.abs(options.shift) > 24) throw new Error('Choose a transposition from −24 to +24 semitones.');
  if (!Number.isInteger(options.capo) || options.capo < 0 || options.capo > 12) throw new Error('Capo must be a whole number from 0 to 12.');
  if (!Number.isInteger(options.maxFret) || options.maxFret < 7 || options.maxFret > 24) throw new Error('Maximum fret must be a whole number from 7 to 24.');
  const tuning = parseTuning(options.tuning);
  const groups: string[][] = []; let group: string[] = [];
  let techniques = false, ignored = false;
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    // Labels are informational: pitch is determined by the selected tuning.
    const match = /^\s*(?:[a-gA-G](?:#|b)?\d?\s*)?\|?([\d\- |hpbrt~\/\\xX().<>^=:]+)\s*$/.exec(raw);
    if (match && (/-/.test(match[1]) || raw.includes('|'))) {
      let row = match[1].trimEnd();
      if (row.startsWith('|')) row = row.slice(1);
      group.push(row);
      techniques ||= /[hpbrt~\/\\xX().<>^=:]/.test(row);
      if (group.length === 6) { groups.push(group); group = []; }
    } else {
      if (group.length) throw new Error('Each tab block needs six consecutive string lines, highest string first.');
      if (raw.trim()) ignored = true;
    }
  }
  if (group.length || !groups.length) throw new Error('Use six-line ASCII guitar tabs, with the high e string at the top and low E at the bottom.');
  const events: Note[][] = [], blocks: string[] = [];
  let shifted = 0, dropped = 0, wide = 0, duplicate = 0;
  for (const rows of groups) {
    if (new Set(rows.map(row => row.length)).size !== 1) throw new Error('The six lines in each block must have the same width. Keep the dashes and fret numbers aligned.');
    const byColumn = new Map<number, number[]>();
    rows.forEach((row, s) => {
      for (const match of row.matchAll(/\d+/g)) {
        const fret = Number(match[0]);
        if (fret > 36) throw new Error(`Fret ${fret} is outside the supported guitar range (0–36).`);
        const pitch = tuning[s] + fret + options.shift + options.capo;
        const notes = byColumn.get(match.index!) ?? [];
        notes.push(pitch); byColumn.set(match.index!, notes);
      }
    });
    const bars = [...rows[0].matchAll(/\|/g)].map(m => m.index!);
    if (rows.some(row => [...row.matchAll(/\|/g)].map(m => m.index!).join(',') !== bars.join(','))) throw new Error('Align the bar lines (|) across all six strings in each block.');
    let rendered = ['E|', 'A|', 'D|', 'G|'];
    const flush = () => { if (rendered[0].length > 2) { blocks.push(rendered.map(r => r.endsWith('|') ? r : r + '|').join('\n')); rendered = ['E|', 'A|', 'D|', 'G|']; } };
    const columns = [...new Set([...byColumn.keys(), ...bars])].sort((a,b) => a-b);
    for (const column of columns) {
      if (bars.includes(column)) {
        rendered = rendered.map(r => r.endsWith('|') ? r : r + '|');
        continue;
      }
      const original = byColumn.get(column)!;
      const pitches = original.map(p => {
        let fitted = p;
        if (options.fold) {
          while (fitted < 55) fitted += 12;
          while (fitted > 76 + options.maxFret) fitted -= 12;
        }
        if (fitted !== p) shifted++;
        if (fitted < 55 || fitted > 76 + options.maxFret) throw new Error('Some notes are outside the mandolin range. Enable octave fitting or change the transposition.');
        return fitted;
      });
      duplicate += pitches.length - new Set(pitches).size;
      const voiced = assign(pitches, options.maxFret);
      dropped += voiced.dropped;
      const frets = voiced.notes.filter(n=>n.fret>0).map(n=>n.fret);
      if (frets.length > 1 && Math.max(...frets) - Math.min(...frets) > 5) wide++;
      events.push(voiced.notes);
      if (events.length > 2000) throw new Error('Convert up to 2,000 note positions at a time. Try a shorter section.');
      const width = Math.max(1, ...voiced.notes.map(n => String(n.fret).length)) + 2;
      if (rendered[0].length + width > 72) flush();
      rendered = rendered.map((r,s) => {
        const note = voiced.notes.find(n=>n.string===s);
        return r + (note ? String(note.fret) : '-').padEnd(width, '-');
      });
    }
    flush();
  }
  if (!events.length) throw new Error('No fret numbers found. Include notes such as 0, 2, or 10 on the string lines.');
  const warnings: string[] = [];
  if (shifted) warnings.push(`${shifted} note${shifted===1?' was':'s were'} moved by octaves to fit the mandolin range.`);
  if (dropped) warnings.push(`${dropped} chord note${dropped===1?' was':'s were'} omitted because they could not fit on separate courses. Review these simplified chords.`);
  if (duplicate) warnings.push(`${duplicate} unison note${duplicate===1?' was':'s were'} combined on one course.`);
  if (wide) warnings.push(`${wide} chord${wide===1?' has':'s have'} a stretch wider than five frets. Review the fingering before playing.`);
  if (techniques) warnings.push('Technique and repeat marks were not carried over. Fret numbers are played as plain notes; repeats play once.');
  if (ignored) warnings.push('Text outside the tab lines was not included. Set the title above; review any written repeat instructions.');
  return { text: blocks.join('\n\n'), blocks, events, warnings, notes: events.reduce((sum,e)=>sum+e.length,0), options: {...options} };
}
