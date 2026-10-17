const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLrc, activeLine, emptyState, validateState, validUri, format } = require('../src/core.js');
const {validateTheme}=require('../src/core.js');
const {defaultBindings,validateBindings,binding,serializeLrc}=require('../src/core.js');
test('Sleep fade reaches silence only at deadline; end-of-song stops on boundary or URI change',()=>{
  const {sleepStatus}=require('../src/core.js');const timer={deadline:60000,endingUri:null,fadeMs:30000},playback={uri:'song',position:0,duration:120000,now:30000};assert.equal(sleepStatus(timer,playback).factor,1);assert.equal(sleepStatus(timer,{...playback,now:45000}).factor,.5);assert.equal(sleepStatus(timer,{...playback,now:60000}).stop,true);assert.equal(sleepStatus(timer,{...playback,now:60000}).factor,0);
  const end={deadline:null,endingUri:'song',fadeMs:0};assert.equal(sleepStatus(end,playback).stop,false);assert.equal(sleepStatus(end,{...playback,position:119700}).stop,true);assert.equal(sleepStatus(end,{...playback,uri:'next'}).stop,true);
});

test('Old backups migrate with default bindings while keeping lyrics and bookmarks',()=>{
  const old={version:1,tracks:{'spotify:local:A:B:C:120':{title:'Song',raw:'[00:01.00]Hi',offset:-100}},bookmarks:[{id:'old',uri:'spotify:track:a',ms:1000,note:'Saved'}],settings:{theme:'plum',fontSize:32}};
  const migrated=validateState(old);assert.deepEqual(migrated.settings.bindings,defaultBindings());assert.equal(migrated.tracks['spotify:local:A:B:C:120'].raw,old.tracks['spotify:local:A:B:C:120'].raw);assert.equal(migrated.bookmarks[0].note,'Saved');
});
test('Recovery timestamps survive validation without being added to legacy backups',()=>{const s=emptyState();assert.equal('modifiedAt' in validateState(s),false);assert.equal(validateState({...s,modifiedAt:12345}).modifiedAt,12345);});
test('Bindings can change and clear, but conflicts and invalid combinations are rejected',()=>{
  const b=validateBindings({...defaultBindings(),lyrics:'Ctrl+Shift+K',stamp:''});assert.equal(b.lyrics,'Ctrl+Shift+K');assert.equal(b.stamp,'');
  assert.throws(()=>validateBindings({...defaultBindings(),lyrics:defaultBindings().bookmark}),/share/);
  assert.throws(()=>validateBindings({lyrics:'K'}));assert.equal(binding({key:'k',ctrlKey:true,shiftKey:true}),'Ctrl+Shift+K');
});
test('Saved loops, mappings, background and custom bindings survive a complete backup',()=>{
  const s=emptyState();s.tracks['spotify:track:x']={title:'Song',artist:'A',raw:'',file:'',offset:0,path:'C:\\Music\\Song.flac',loops:[{name:'Verse',a:1000,b:5000}]};s.settings.bindings.lyrics='Ctrl+Shift+K';s.settings.customTheme.backgroundImage='data:image/png;base64,YQ==';s.settings.customTheme.fontFamily='Georgia';assert.deepEqual(validateState(s),s);
  assert.throws(()=>validateState({...s,tracks:{'spotify:track:x':{loops:[{a:500,b:600}]}}}));
});
test('Edited lyrics round trip timestamps, metadata and offset without accepting missing times',()=>{
  const text=serializeLrc([{ms:1234,text:'One'},{ms:61000,text:'Two'}],{ti:'Title',ar:'Artist'},-120);const parsed=parseLrc(text);assert.equal(parsed.offset,-120);assert.equal(parsed.meta.ti,'Title');assert.deepEqual(parsed.lines,[{ms:1230,text:'One'},{ms:61000,text:'Two'}]);assert.throws(()=>serializeLrc([{ms:null,text:'Untimed'}]));
});
test('LRC metadata, repeated stamps, hundredths and thousandths', () => {
  const parsed = parseLrc('\uFEFF[ar:Example Artist]\n[offset:-250]\n[01:03.45][02:04.123]Hello\n[00:01.5]First\r\n[ti:Example]');
  assert.deepEqual(parsed.lines, [{ms:1500,text:'First'}, {ms:63450,text:'Hello'}, {ms:124123,text:'Hello'}]);
  assert.equal(parsed.meta.ar, 'Example Artist'); assert.equal(parsed.offset, -250);
});
test('Empty instrumental lines and enhanced word tags', () => {
  assert.deepEqual(parseLrc('[00:01.00]\n[00:02.00]<00:02.00>Two <00:02.50>words').lines, [{ms:1000,text:''},{ms:2000,text:'Two words'}]);
});
test('Invalid time stamps cannot become lyric lines', () => {
  assert.deepEqual(parseLrc('plain text\n[00:99.00]Bad seconds').lines, []);
});
test('Active line accounts for positive/negative delays and backwards seeks', () => {
  const lines = [{ms:1000},{ms:2000},{ms:3000}];
  assert.equal(activeLine(lines, 999), -1); assert.equal(activeLine(lines, 1000), 0);
  assert.equal(activeLine(lines, 2200, 300), 0); assert.equal(activeLine(lines, 1800, -300), 1);
  assert.equal(activeLine(lines, 10000), 2); assert.equal(activeLine(lines, 1500), 0);
});
test('Repeated timestamps resolve to the last matching line', () => assert.equal(activeLine([{ms:1},{ms:1},{ms:2}], 1), 1));
test('URI validation rejects script URLs and object keys', () => {
  assert.equal(validUri('spotify:local:Artist:Album:Song:123'), true);
  for (const value of ['__proto__', 'javascript:alert(1)', 'https://example.com', null, 'spotify:track:x y']) assert.equal(validUri(value), false);
});
test('Backup round trip preserves lyrics, offset, notes and theme', () => {
  const state = emptyState();
  state.tracks['spotify:local:A:B:C:120'] = {title:'Song',artist:'Artist',raw:'[00:01.00]Hi',file:'song.lrc',offset:-150};
  state.bookmarks.push({id:'one',uri:'spotify:track:abc',ms:5000,title:'Song',note:'Verse'});
  state.settings.theme = 'midnight';
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
});
test('Malformed backups and oversized lyrics are rejected', () => {
  assert.throws(() => validateState({version:2}));
  assert.throws(() => validateState({...emptyState(), tracks:{'javascript:abc':{}}}));
  assert.throws(() => validateState({...emptyState(), tracks:{'spotify:track:x':{raw:'x'.repeat(512*1024+1)}}}));
  assert.throws(() => validateState({...emptyState(), bookmarks:[{uri:'spotify:track:x',ms:-1}]}));
});
test('Settings bounds and defaults', () => {
  const state = validateState({...emptyState(), settings:{theme:'invalid',fontSize:900}});
  assert.equal(state.settings.theme,'forest'); assert.equal(state.settings.fontSize,48);
  assert.equal(format(65000),'1:05'); assert.equal(format(-5),'0:00');
});
test('Custom themes survive backups and reject executable color values',()=>{
  const state=emptyState();state.settings.theme='custom';state.settings.customTheme={...state.settings.customTheme,name:'Amber',accent:'#ffb34d'};state.settings.savedThemes=[state.settings.customTheme];
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>validateTheme({background:'url(https://example.com/x)'}));
  assert.throws(()=>validateTheme({accent:'red;display:none'}));
  assert.equal(validUri('spotify:episode:abc'),true);assert.equal(validUri('spotify:chapter:abc'),true);
});
