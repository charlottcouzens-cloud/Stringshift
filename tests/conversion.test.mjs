import test from 'node:test';
import assert from 'node:assert/strict';
import {convertTab, DEFAULT_OPTIONS, EXAMPLE, parseTuning} from '../lib/tabs.ts';

const tab = (notes) => ['e','B','G','D','A','E'].map((label,i)=>`${label}|${notes[i]??'---'}|`).join('\n');
test('example produces the intended melody pitches',()=>{
  const result=convertTab(EXAMPLE);
  assert.deepEqual(result.events.map(e=>e[0].pitch),[55,55,57,59,57,55,55,64,55,55,57,59,62,59,57,55]);
  assert.equal(result.notes,16);
});
test('open guitar high E remains E4, mandolin D course fret 2',()=>{
  assert.deepEqual(convertTab(tab(['0--'])).events[0],[{string:2,fret:2,pitch:64}]);
});
test('low guitar E is raised two octaves and disclosed',()=>{
  const result=convertTab(tab([null,null,null,null,null,'0--']));
  assert.equal(result.events[0][0].pitch,64);
  assert.match(result.warnings.join(' '),/moved by octaves/);
});
test('exact pitch mode rejects an out-of-range note',()=>{
  assert.throws(()=>convertTab(tab([null,null,null,null,null,'0--']),{...DEFAULT_OPTIONS,fold:false}),/outside the mandolin range/);
});
test('transposition and capo add to sounding pitch',()=>{
  assert.equal(convertTab(tab(['0--']),{...DEFAULT_OPTIONS,shift:-2,capo:3}).events[0][0].pitch,65);
});
test('custom tuning accepts flats and sharps with octaves',()=>{
  assert.deepEqual(parseTuning('D2 A2 D3 G3 Bb3 F#4'),[66,58,55,50,45,38]);
  assert.throws(()=>parseTuning('E A D G B E'),/Invalid tuning note/);
});
test('multi-digit fret is one event; chords occupy distinct courses',()=>{
  const result=convertTab(tab(['12-','10-','9--','---','---','---']));
  assert.equal(result.events.length,1);
  assert.deepEqual(result.events[0].map(n=>n.pitch).sort((a,b)=>a-b),[64,69,76]);
  assert.equal(new Set(result.events[0].map(n=>n.string)).size,3);
});
test('unplayable chord notes are disclosed',()=>{
  const result=convertTab(tab(['0--','0--','0--','0--','0--','0--']));
  assert.ok(result.events[0].length<=4);
  assert.match(result.warnings.join(' '),/omitted/);
});
test('multiple blocks retain note order and bars',()=>{
  const result=convertTab(`${tab(['0--'])}\n\n${tab(['2--'])}`);
  assert.deepEqual(result.events.map(e=>e[0].pitch),[64,66]);
  assert.equal(result.blocks.length,2);
});
test('invalid inputs fail with actionable errors',()=>{
  for(const input of ['', 'hello', 'e|--0--|',tab(['---'])])assert.throws(()=>convertTab(input));
  assert.throws(()=>convertTab(tab(['100'])),/outside the supported guitar range/);
  assert.throws(()=>convertTab(EXAMPLE,{...DEFAULT_OPTIONS,shift:2.5}),/transposition/);
  assert.throws(()=>convertTab(EXAMPLE,{...DEFAULT_OPTIONS,capo:13}),/Capo/);
  assert.throws(()=>convertTab(EXAMPLE,{...DEFAULT_OPTIONS,maxFret:0}),/Maximum fret/);
});
test('misaligned strings fail instead of shifting notes silently',()=>{
  assert.throws(()=>convertTab(tab(['0----'])),/same width/);
});
test('techniques generate plain notes and a warning',()=>{
  const result=convertTab(tab(['0h2-','----','----','----','----','----']));
  assert.deepEqual(result.events.map(e=>e[0].pitch),[64,66]);
  assert.match(result.warnings.join(' '),/Technique/);
});
test('all generated frets preserve the requested sounding pitches',()=>{
  for(let fret=0;fret<=36;fret++){
    const result=convertTab(tab([String(fret).padEnd(3,'-')]));
    const n=result.events[0][0];
    assert.equal([76,69,62,55][n.string]+n.fret,n.pitch);
    assert.ok(n.fret>=0 && n.fret<=19);
    assert.equal(((n.pitch-(64+fret))%12+12)%12,0);
  }
});
