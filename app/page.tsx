'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Music2, Download, SlidersHorizontal, Play, Pause, Square, Guitar, AudioLines, Copy, RotateCcw } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { convertTab, DEFAULT_OPTIONS, EXAMPLE, TUNINGS, type Conversion, type Options } from '@/lib/tabs';

const KEYS = ['C','C# / Db','D','D# / Eb','E','F','F# / Gb','G','G# / Ab','A','A# / Bb','B'];
const tuningLabels: Record<string,string> = {standard:'Standard · E A D G B E',dropD:'Drop D · D A D G B E',dadgad:'DADGAD',openG:'Open G · D G D G B D',custom:'Custom tuning'};
function Choice({id,label,value,items,onChange}: {id:string;label:string;value:string;items:{value:string;label:string}[];onChange:(value:string)=>void}) {
  return <><label id={`${id}-label`}>{label}</label><Select value={value} onValueChange={v=>{if(v!==null)onChange(v)}} items={items}><SelectTrigger id={id} aria-labelledby={`${id}-label`} className="control-select"><SelectValue/></SelectTrigger><SelectContent>{items.map(i=><SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select></>;
}
const formatTime = (seconds:number) => `${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;

export default function Home() {
  const [title,setTitle] = useState('A little mountain melody');
  const [source,setSource] = useState(EXAMPLE);
  const [tuning,setTuning] = useState('standard');
  const [customTuning,setCustomTuning] = useState(TUNINGS.standard);
  const [mode,setMode] = useState('semitones');
  const [semitones,setSemitones] = useState('0');
  const [from,setFrom] = useState('0');
  const [to,setTo] = useState('0');
  const [capo,setCapo] = useState('0');
  const [maxFret,setMaxFret] = useState('19');
  const [fold,setFold] = useState(true);
  const [result,setResult] = useState<Conversion>(()=>convertTab(EXAMPLE));
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [dirty,setDirty] = useState(false);
  const [tempo,setTempo] = useState(96);
  const [subdivision,setSubdivision] = useState('2');
  const [playing,setPlaying] = useState(false);
  const [position,setPosition] = useState(0);
  const [copied,setCopied] = useState(false);
  const context = useRef<AudioContext|null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const playIndex = useRef(0);
  const playGeneration = useRef(0);
  const liveNodes = useRef<OscillatorNode[]>([]);
  const active = useRef(false);
  const tempoRef = useRef(tempo); tempoRef.current=tempo;
  const subdivisionRef = useRef(subdivision); subdivisionRef.current=subdivision;
  const copyTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const shift = mode==='keys' ? ((Number(to)-Number(from)+18)%12)-6 : Number(semitones);
  const options:Options = {tuning:tuning==='custom'?customTuning:TUNINGS[tuning],shift,capo:Number(capo),maxFret:Number(maxFret),fold};
  const available = !dirty && !error && result.events.length>0;
  const duration = result.events.length*60/tempo/Number(subdivision);

  function silence() {
    playGeneration.current++;
    active.current=false;
    if(timer.current) clearTimeout(timer.current);
    liveNodes.current.forEach(node=>{try{node.stop()}catch{ /* already ended */ }});
    liveNodes.current=[];
    setPlaying(false);
  }
  function stop() {silence();playIndex.current=0;setPosition(0)}
  function changed(action:()=>void) { stop();action();setDirty(true);setError('');setNotice(''); }
  function convert() {
    stop();setNotice('');
    try {const next=convertTab(source,options);setResult(next);setDirty(false);setError('');setNotice(`Converted ${next.notes} notes. Ready to play.`)}
    catch(e){setError(e instanceof Error?e.message:'Could not convert this tab.');}
  }
  function example() {
    stop();setSource(EXAMPLE);setTitle('A little mountain melody');setTuning('standard');setMode('semitones');setSemitones('0');setCapo('0');setFold(true);setMaxFret('19');setResult(convertTab(EXAMPLE));setDirty(false);setError('');setNotice('Example loaded. Press play to listen.');
  }
  function pluck(pitch:number,start:number,length:number) {
    const ctx=context.current!;
    // Two slightly detuned voices suggest the mandolin's paired strings.
    for(const detune of [-2.5,2.5]) {
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      oscillator.type='triangle';oscillator.frequency.value=440*Math.pow(2,(pitch-69)/12);oscillator.detune.value=detune;
      filter.type='lowpass';filter.frequency.value=3200;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.095,start+.004);gain.gain.exponentialRampToValueAtTime(.001,start+length);
      oscillator.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
      liveNodes.current.push(oscillator);
      oscillator.onended=()=>{oscillator.disconnect();filter.disconnect();gain.disconnect();liveNodes.current=liveNodes.current.filter(n=>n!==oscillator)};
      oscillator.start(start);oscillator.stop(start+length+.02);
    }
  }
  async function play() {
    if(playing){silence();return}
    if(!available)return;
    const generation=++playGeneration.current;
    try {
      context.current ??= new AudioContext();
      await context.current.resume();
      if(generation!==playGeneration.current)return;
      if(playIndex.current>=result.events.length) playIndex.current=0;
      active.current=true;setPlaying(true);setNotice('');
      let nextTime=context.current.currentTime+.04;
      const tick=()=>{
        if(!active.current)return;
        const ctx=context.current!;
        if(ctx.currentTime+.015<nextTime){timer.current=setTimeout(tick,15);return}
        if(playIndex.current>=result.events.length){active.current=false;setPlaying(false);setPosition(result.events.length);return}
        // Avoid bursts if a background tab's timers are throttled.
        nextTime=Math.max(nextTime,ctx.currentTime);
        const seconds=60/tempoRef.current/Number(subdivisionRef.current);
        result.events[playIndex.current].forEach(n=>pluck(n.pitch,nextTime,Math.min(.9,seconds*1.6)));
        playIndex.current++;setPosition(playIndex.current);
        nextTime+=seconds;
        timer.current=setTimeout(tick,15);
      };
      tick();
    } catch {silence();setNotice('Audio could not start. Check your browser’s audio permission and try again.')}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(result.text);setCopied(true);if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),1800)}
    catch {setNotice('Copy is unavailable here. Select the mandolin tab and copy it with your keyboard.')}
  }
  function print() {silence();setNotice('Choose “Save as PDF” as the destination in the print dialog.');window.print()}

  useEffect(()=>()=>{active.current=false;playGeneration.current++;if(timer.current)clearTimeout(timer.current);if(copyTimer.current)clearTimeout(copyTimer.current);void context.current?.close()},[]);
  useEffect(()=>{
    const modelContext=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
    if(!modelContext?.registerTool)return;
    const lifecycle=new AbortController();
    try {void Promise.resolve(modelContext.registerTool({
      name:'convert_guitar_tab',title:'Convert guitar tab to mandolin',description:'Convert six-line guitar ASCII tabs, update the visible editors, and return the generated mandolin arrangement. Uses standard guitar tuning and octave fitting.',
      inputSchema:{type:'object',properties:{tab:{type:'string'},title:{type:'string'},semitones:{type:'integer',minimum:-24,maximum:24}},required:['tab'],additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:true},
      execute(input:unknown){
        const data=input as {tab?:unknown;title?:unknown;semitones?:unknown};
        if(!data||typeof data.tab!=='string'||(data.title!==undefined&&typeof data.title!=='string')||(data.semitones!==undefined&&(!Number.isInteger(data.semitones)||Math.abs(Number(data.semitones))>24)))throw new Error('Provide a tab string, optional title, and an integer semitone shift from −24 to +24.');
        const value=Number(data.semitones??0);const converted=convertTab(data.tab,{...DEFAULT_OPTIONS,shift:value});
        flushSync(()=>{stop();setSource(data.tab as string);setTitle(typeof data.title==='string'?data.title.slice(0,150):'Untitled arrangement');setTuning('standard');setMode('semitones');setSemitones(String(value));setCapo('0');setMaxFret('19');setFold(true);setResult(converted);setDirty(false);setError('');setNotice('Tab converted.');});
        return {tab:converted.text,noteCount:converted.notes,warnings:converted.warnings};
      },
    },{signal:lifecycle.signal})).catch(()=>{});}catch{ /* Enhancement unavailable in this browser. */ }
    return ()=>lifecycle.abort();
  },[]);

  return <><main className="studio"><header className="topbar"><a className="brand" href="/"><span className="brandmark"><AudioLines size={23}/></span>Stringshift <span className="brand-note">TAB STUDIO</span></a><span className="top-note">Six strings. A new voice.</span></header>
    <div className="intro"><div><p className="eyebrow">GUITAR → MANDOLIN</p><h1>Same melody. New strings.</h1><p>Bring your guitar tabs to the mandolin.</p></div><button className="secondary" onClick={print} disabled={!available}><Download size={17}/> Save as PDF</button></div>
    <div className="title-row"><label htmlFor="title">TAB TITLE</label><input id="title" value={title} maxLength={150} placeholder="Untitled arrangement" onChange={e=>setTitle(e.target.value)}/><span>YOUR ARRANGEMENT</span></div>
    <div className="workspace">
      <section className="editor panel"><div className="panel-head"><h2><Guitar size={20}/> Guitar tab</h2><span className="badge">INPUT</span></div><div className="editor-meta"><span>{tuning==='custom'?'Custom tuning':tuning==='standard'?'Standard tuning':tuning==='dropD'?'Drop D tuning':tuning==='openG'?'Open G tuning':'DADGAD tuning'}</span><span>6 STRINGS</span></div><textarea aria-label="Guitar tab" aria-describedby="input-help" spellCheck={false} autoCapitalize="off" wrap="off" value={source} onChange={e=>changed(()=>setSource(e.target.value))} placeholder={'Paste your guitar tab here…\n\ne|----------------|\nB|----------------|\nG|--0--2--4-------|\nD|----------------|\nA|----------------|\nE|----------------|'}/><div className="editor-foot"><span id="input-help">High string first · Plain-text tabs</span><button className="quiet" onClick={example}><RotateCcw size={13}/> Example</button></div></section>
      <section className="editor panel output-panel"><div className="panel-head"><h2><Music2 size={20}/> Mandolin tab</h2><span className="badge green">{dirty?'UPDATE':'OUTPUT'}</span></div><div className="editor-meta"><span>Standard tuning</span><span>G D A E</span></div><textarea aria-label="Generated mandolin tab" aria-describedby="output-help" readOnly wrap="off" value={result.text}/><div className="editor-foot"><span id="output-help">{dirty?'Convert to update this result':`${result.notes} notes · ${result.blocks.length} tab ${result.blocks.length===1?'block':'blocks'}`}</span><button className={`quiet ${copied?'copy-state':''}`} onClick={copy} disabled={!available}><Copy size={13}/>{copied?'Copied':'Copy'}</button></div></section>
      <aside className="panel settings"><h2><SlidersHorizontal size={19}/> Make it yours</h2><p>Change the key. Find your fingering.</p>
        <Choice id="tuning" label="Guitar tuning" value={tuning} items={Object.entries(tuningLabels).map(([value,label])=>({value,label}))} onChange={v=>changed(()=>setTuning(v))}/>
        {tuning==='custom'&&<><label htmlFor="custom-tuning">Notes, low to high</label><input className="input-field" id="custom-tuning" value={customTuning} onChange={e=>changed(()=>setCustomTuning(e.target.value))}/><small>Include octaves, e.g. E2 A2 D3 G3 B3 E4. Tab labels don’t override this tuning.</small></>}
        <Choice id="change-mode" label="Guitar key changer" value={mode} items={[{value:'semitones',label:'Custom semitone shift'},{value:'keys',label:'From key → to key'}]} onChange={v=>changed(()=>setMode(v))}/>
        {mode==='semitones'?<><label htmlFor="shift">Semitones</label><input id="shift" className="input-field" type="number" min="-24" max="24" step="1" value={semitones} onChange={e=>changed(()=>setSemitones(e.target.value))}/></>:<div className="two-fields"><div><Choice id="from" label="From key" value={from} items={KEYS.map((label,i)=>({label,value:String(i)}))} onChange={v=>changed(()=>setFrom(v))}/></div><div><Choice id="to" label="To key" value={to} items={KEYS.map((label,i)=>({label,value:String(i)}))} onChange={v=>changed(()=>setTo(v))}/></div></div>}
        <small>{shift===0?'Keep the original pitch.':`${shift>0?'+':''}${shift} semitones applied before octave fitting.`}{mode==='keys'?' Uses the nearest shift. Major/minor quality stays the same.':''}</small>
        <div className="two-fields"><div><label htmlFor="capo">Guitar capo</label><input id="capo" className="input-field" type="number" min="0" max="12" step="1" value={capo} onChange={e=>changed(()=>setCapo(e.target.value))}/></div><div><label htmlFor="max-fret">Max. mando fret</label><input id="max-fret" className="input-field" type="number" min="7" max="24" step="1" value={maxFret} onChange={e=>changed(()=>setMaxFret(e.target.value))}/></div></div>
        <small>Guitar fret numbers are relative to the capo.</small><hr className="setting-divider"/><div className="switch-row"><label htmlFor="fold">Fit notes by octave</label><Switch id="fold" checked={fold} onCheckedChange={v=>changed(()=>setFold(v))}/></div><small>Move out-of-range notes by octaves. Turn off to preserve exact pitch.</small>
        <button className="primary" onClick={convert}>Convert to mandolin <ArrowRight size={17}/></button>
      </aside>
      <div className="player panel"><div className="transport"><button className="play-button" onClick={play} disabled={!available} aria-label={playing?'Pause mandolin playback':'Play mandolin tabs'}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button className="quiet" onClick={stop} aria-label="Stop and rewind" disabled={!playing&&position===0}><Square size={15}/></button></div><div className="play-info"><strong>{playing?'Playing your arrangement':position>0&&position<result.events.length?'Playback paused':'Hear your arrangement'}</strong><p>Mandolin synth · Even-note timing</p></div><div className="tempo"><label id="tempo-label">Tempo <span>{tempo} BPM</span></label><Slider aria-labelledby="tempo-label" min={40} max={220} step={1} value={[tempo]} onValueChange={v=>setTempo(Array.isArray(v)?v[0]:v)}/></div><div className="beat-choice"><Choice id="rhythm" label="Notes per beat" value={subdivision} items={[{value:'1',label:'1 · Quarter notes'},{value:'2',label:'2 · Eighth notes'},{value:'4',label:'4 · Sixteenth notes'}]} onChange={setSubdivision}/></div><div className="progress-row"><span>{formatTime(position*60/tempo/Number(subdivision))}</span><div className="progress-track" role="progressbar" aria-label="Playback position" aria-valuemin={0} aria-valuemax={result.events.length} aria-valuenow={position}><div className="progress-fill" style={{width:`${100*position/result.events.length}%`}}/></div><span>{formatTime(duration)}</span></div></div>
      <div className={`status ${error?'error':''}`} role={error?'alert':'status'} aria-live="polite"><p>{error||notice||(dirty?'Your tab or settings changed. Convert again to update the arrangement.':'Your arrangement is ready. Press play to hear it.')}</p>{!dirty&&!error&&result.warnings.map(w=><p key={w}>{w}</p>)}</div>
      <details className="explanation"><summary>A few things to know about tab conversion</summary><p>Paste six consecutive string lines with aligned dashes and bar lines. Use the selected guitar tuning, with the highest string at the top. Multiple blocks and multi-digit frets are supported. A number in the same column is treated as part of a chord.</p><p>Plain-text tabs rarely contain exact rhythm. Notes are evenly spaced here; adjust the tempo and notes per beat to practice. Bends, slides, hammer-ons, muted hits, rests, and repeats are not reproduced. The synth is an approximation of plucked paired strings.</p><p>Mandolin has four courses. The converter favors lower frets, combines unisons, and flags chords it simplifies or that require a wide stretch. Check the fingering before playing. Guitar key changes transpose the generated arrangement; your pasted source stays available for further changes.</p><p>Save as PDF opens your browser’s print dialog. Choose “Save as PDF”; the export contains the title, tuning, settings, and complete mandolin tabs. Nothing you paste is uploaded.</p><p>Tuning references: <a href="https://www.fender.com/articles/setup/standard-tuning-how-eadgbe-came-to-be" target="_blank" rel="noreferrer">Fender guitar tuning</a> · <a href="https://assets.kogan.com/files/usermanuals/RYAMANDOSBA_UG.pdf" target="_blank" rel="noreferrer">Mandolin tuning guide</a>.</p></details>
    </div><footer><span>Made for the next instrument you pick up.</span><span>Guitar tabs in. Mandolin music out.</span></footer>
  </main><article className="print-sheet"><h1>{title.trim()||'Untitled arrangement'}</h1><p>MANDOLIN TAB · G3 D4 A4 E5 (low to high)</p><p>Guitar tuning: {result.options.tuning} · Capo: {result.options.capo} · Transposition: {result.options.shift>0?'+':''}{result.options.shift} semitones · Tempo: {tempo} BPM · {subdivision} notes per beat</p><p>Even-note timing is an approximation. Technique and repeat marks are not reproduced.</p>{result.warnings.map(w=><p className="print-warning" key={w}>{w}</p>)}{result.blocks.map((block,i)=><pre key={i}>{block}</pre>)}<p>Stringshift · Guitar to mandolin</p></article></>;
}
