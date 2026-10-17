/* Inlined inside the version-bound integration by scripts/build.cjs. */
  const desktopConfig = /*MYIFY_CONFIG*/null;
  let bridgePending=false,desktopConnected=false,desktopStatus='Desktop tools are not connected. Launch Spotify using the Myify shortcut.',compatibility=null,commandAcks=[],executedCommands=new Set(),bridgeLast=0;
  let endOfSong=null,fade=null,editorSession=null;
  const defaults=Core.defaultBindings();
  const shortcutLabels={lyrics:'Open lyrics',bookmark:'Add bookmark',tools:'Playback tools',back:'Seek back 10 seconds',forward:'Seek forward 10 seconds',setA:'Set loop A',setB:'Set loop B',clearLoop:'Clear loop',editor:'Lyrics editor',stamp:'Timestamp next lyric line',mini:'Mini-player',generate:'Generate local lyrics',theme:'Cycle themes'};
  async function desktopRequest(path,body={}){
    if(!desktopConfig)throw Error('Install the combined Myify update, then launch Spotify from its Myify shortcut.');
    const response=await fetch(`http://127.0.0.1:${desktopConfig.port}${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+desktopConfig.token},body:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Myify desktop tools did not respond.');return data;
  }
  async function openDesktop(action){try{const item=current();await desktopRequest('/open',{action,item:{uri:item?.uri,title:item?.name,artist:artist(item),duration:player?.getState()?.duration}});say(action==='generate'?'Opening local lyric generation…':'Myify desktop tools opened.');}catch{throw Error('Launch Spotify using the Myify shortcut to start its desktop tools.');}}
  async function desktopCommand(command){
    switch(command.action){
      case'toggle':return player.getState()?.isPaused?player.resume({featureIdentifier:'local_enhancer'}):player.pause();
      case'next':return player.skipToNext();
      case'previous':return player.skipToPrevious();
      case'back':return seek(progress()-10000);
      case'forward':return seek(progress()+10000);
      case'attach':{
        if(!playable(command.uri)||typeof command.raw!=='string'||command.raw.length>512*1024||!Core.parseLrc(command.raw).lines.length)throw Error('Generated lyrics were invalid or too large.');
        const item=current(),old=state.tracks[command.uri]||{};
        const next={title:old.title||(item?.uri===command.uri?item.name:'Generated local lyrics'),artist:old.artist||(item?.uri===command.uri?artist(item):''),offset:0,...old,raw:command.raw,file:String(command.file||'generated.lrc'),...(command.path?{path:String(command.path)}:{})};
        if(save({...state,tracks:{...state.tracks,[command.uri]:next}}))say('Generated lyrics attached. Open the lyrics editor to review.');
        return;
      }
      default:throw Error('Unknown desktop control.');
    }
  }
  async function syncDesktop(){
    if(bridgePending||!player||!desktopConfig||Date.now()-bridgeLast<(desktopConnected?500:3000))return;
    bridgePending=true;bridgeLast=Date.now();const item=current(),data=localData(currentUri),position=progress();
    const index=data?Core.activeLine(data.lyrics.map(line=>({ms:line.start})),position):-1;
    try{
      const sentAcks=[...commandAcks];
      const reply=await desktopRequest('/sync',{uri:item?.uri||'',title:item?.name||'',artist:artist(item),position,duration:player.getState()?.duration||0,paused:!!player.getState()?.isPaused,line:index>=0?data.lyrics[index].text:'',acks:sentAcks});
      commandAcks=commandAcks.filter(id=>!sentAcks.includes(id));desktopConnected=true;desktopStatus=reply.status;compatibility=reply.compatibility;
      for(const command of reply.commands||[]){
        if(!executedCommands.has(command.id)){executedCommands.add(command.id);try{await desktopCommand(command);}catch(e){say(e.message);}}
        if(!commandAcks.includes(command.id))commandAcks.push(command.id);
      }
      if(executedCommands.size>1000)executedCommands=new Set(commandAcks);
    }catch{desktopConnected=false;}finally{bridgePending=false;}
  }
  function setPoint(which){const buttons=within('[data-le-loop]').querySelectorAll('button');buttons[which==='a'?0:1].click();}
  function cycleTheme(){const themes=['forest','midnight','plum','custom'],theme=themes[(themes.indexOf(state.settings.theme)+1)%themes.length];if(save({...state,settings:{...state.settings,theme}})){appearance();say('Theme: '+theme);}}
  const actions={lyrics:()=>navigate('/lyrics'),bookmark:addBookmark,tools:()=>popover.hidden?open():close(),back:()=>seek(progress()-10000),forward:()=>seek(progress()+10000),setA:()=>setPoint('a'),setB:()=>setPoint('b'),clearLoop:()=>{loop=null;loopStatus();},editor:openEditor,stamp:stampLine,mini:()=>openDesktop('mini'),generate:()=>openDesktop('generate'),theme:cycleTheme};
  function handleShortcut(event){
    if(event.repeat||event.isComposing)return;
    if(event.key==='Escape'&&!popover.hidden){close();return;}
    const action=Object.keys(state.settings.bindings).find(name=>state.settings.bindings[name]===Core.binding(event));if(!action)return;
    if(event.target?.matches?.('input,textarea,select,[contenteditable=true]')&&!(action==='stamp'&&editorSession))return;
    event.preventDefault();try{const result=actions[action]();if(result?.catch)result.catch(e=>say(e.message));}catch(e){say(e.message);}
  }
  function openEditor(){
    if(!playable(currentUri))return say('Choose a song first.');
    if(editorSession){editorSession.dialog.focus();return;}
    const item=current(),uri=currentUri,rec=state.tracks[uri],parsed=Core.parseLrc(rec?.raw||'');
    const dialog=el('dialog',undefined,'le-editor');dialog.setAttribute('aria-label','Myify lyrics editor');
    const heading=el('h2','Lyrics editor · '+item.name),message=el('p','Load timed lyrics or paste one lyric line per row, then tap Timestamp next as you listen.','le-subtle');
    const source=el('textarea',undefined,'le-input');source.rows=4;source.style.width='100%';source.placeholder='Paste lyrics here, one line per row';
    const rows=el('div');rows.className='le-editor-lines';
    const toolbar=el('div',undefined,'le-row');
    editorSession={dialog,uri,title:item.name,artist:artist(item),lines:parsed.lines.map(x=>({...x})),meta:parsed.meta,offset:parsed.offset,next:0,rows,message};
    const importFile=el('input');importFile.type='file';importFile.accept='.lrc,.txt';importFile.hidden=true;
    importFile.onchange=async()=>{const f=importFile.files[0];importFile.value='';if(!f)return;try{if(f.size>512*1024)throw Error('Choose a file smaller than 512 KB.');loadEditorText(await f.text());}catch(e){message.textContent=e.message;}};
    toolbar.append(button('Import .lrc / text',()=>importFile.click()),button('Load pasted lines',()=>loadEditorText(source.value)),button('Timestamp next',stampLine,true),button('Start from first line',()=>{editorSession.next=0;renderEditor();}),importFile);
    const shift=el('input',undefined,'le-input');shift.type='number';shift.value='100';shift.step='100';shift.setAttribute('aria-label','Shift all lines by milliseconds');shift.style.width='110px';
    const shiftRow=el('div',undefined,'le-row');shiftRow.style.margin='12px 0';shiftRow.append(el('label','Shift all lines (ms)'),shift,button('Apply shift',()=>{const amount=Number(shift.value);if(!Number.isFinite(amount)||Math.abs(amount)>600000)throw Error('Choose a shift within ±600000 ms.');editorSession.lines=editorSession.lines.map(l=>({...l,ms:l.ms===null?null:Math.max(0,l.ms+amount)}));renderEditor();}));
    const footer=el('div',undefined,'le-row');
    function text(){const s=editorSession;return Core.serializeLrc(s.lines,{...s.meta,ti:s.title,ar:s.artist},s.offset);}
    footer.append(button('Save corrections',()=>{const raw=text(),s=editorSession,old=state.tracks[s.uri]||{};if(raw.length>512*1024)throw Error('Lyrics are too large.');if(save({...state,tracks:{...state.tracks,[s.uri]:{title:s.title,artist:s.artist,file:'edited.lrc',offset:0,...old,raw}}})){message.textContent='Corrections saved to this song.';}} ,true),button('Export .lrc',()=>download('lyrics.lrc',text())),button('Close',()=>dialog.close()));
    dialog.append(heading,message,toolbar,source,shiftRow,rows,footer);document.body.append(dialog);dialog.addEventListener('close',()=>{editorSession=null;dialog.remove();});dialog.showModal();renderEditor();
  }
  function loadEditorText(raw){
    const parsed=Core.parseLrc(raw),s=editorSession;if(!s)return;
    s.lines=parsed.lines.length?parsed.lines:raw.split(/\r?\n/).filter(x=>x.trim()).map(text=>({ms:null,text}));s.meta=parsed.meta;s.offset=parsed.offset;s.next=0;renderEditor();
  }
  function renderEditor(){
    const s=editorSession;if(!s)return;s.rows.replaceChildren();
    s.lines.forEach((line,index)=>{const row=el('div',undefined,'le-row le-editor-line');if(index===s.next)row.dataset.next='true';
      const time=el('input',undefined,'le-input');time.type='number';time.step='.01';time.min='0';time.placeholder='Seconds';time.value=line.ms===null?'':(line.ms/1000).toFixed(2);time.setAttribute('aria-label','Line '+(index+1)+' timestamp in seconds');time.style.width='105px';
      time.onchange=()=>{line.ms=time.value===''?null:Math.max(0,Number(time.value)*1000);};
      const content=el('input',undefined,'le-input');content.value=line.text;content.style.flex='1';content.setAttribute('aria-label','Line '+(index+1)+' lyrics');content.oninput=()=>{line.text=content.value;};
      row.append(el('span',String(index+1)),time,content,button('Stamp',()=>{s.next=index;stampLine();}),button('Remove',()=>{s.lines.splice(index,1);s.next=Math.min(s.next,s.lines.length);renderEditor();}));s.rows.append(row);
    });
    s.message.textContent=`Next line: ${Math.min(s.next+1,s.lines.length)} / ${s.lines.length}. Shortcut: ${state.settings.bindings.stamp||'Unassigned'}. Times are seconds.`;
  }
  function stampLine(){
    const s=editorSession;if(!s)return openEditor();if(currentUri!==s.uri)return say('Return to the song being edited before timestamping.');
    if(s.next>=s.lines.length)return;s.lines[s.next++].ms=Math.max(0,Math.round(progress()-(state.tracks[s.uri]?.offset||0)-s.offset));renderEditor();s.rows.querySelector('[data-next]')?.scrollIntoView({block:'nearest'});
  }
  function extraSettings(section,intro,card){
    const lyricButtons=el('div',undefined,'le-row');lyricButtons.append(button('Lyrics editor',openEditor),button('Generate local lyrics',()=>openDesktop('generate')),button('Mini-player',()=>openDesktop('mini')),button('Local library',()=>openDesktop('library')));intro.append(lyricButtons);
    const appearanceCard=card('Background & fonts'),font=el('select',undefined,'le-input');
    for(const value of ['System','Segoe UI','Arial','Georgia','Consolas']){const option=el('option',value);option.value=value;font.append(option);}font.value=state.settings.customTheme.fontFamily||'System';
    function custom(patch){const customTheme=Core.validateTheme({...state.settings.customTheme,...patch});if(save({...state,settings:{...state.settings,theme:'custom',customTheme}}))appearance();}
    font.onchange=()=>custom({fontFamily:font.value});row(appearanceCard,'App font',font);
    const image=el('input');image.type='file';image.accept='image/png,image/jpeg,image/webp';image.hidden=true;
    image.onchange=async()=>{const file=image.files[0];image.value='';if(!file)return;try{if(file.size>1000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image under 1 MB.');const reader=new FileReader();reader.onload=()=>custom({backgroundImage:reader.result});reader.readAsDataURL(file);}catch(e){say(e.message);}};
    const imageButtons=el('div',undefined,'le-row');imageButtons.append(button('Choose background image',()=>image.click()),button('Remove background',()=>custom({backgroundImage:''})),image);appearanceCard.append(imageButtons);
    const loops=card('Saved A/B loops'),list=el('div');list.dataset.leSavedLoops='';
    loops.append(button('Save current loop',()=>{if(!loop||loop.b===null)return say('Set A and B first.');const name=prompt('Name this loop','Loop '+((state.tracks[currentUri]?.loops?.length||0)+1));if(!name)return;const saved=[...(state.tracks[currentUri]?.loops||[]),{name:name.slice(0,100),a:loop.a,b:loop.b}];if(saved.length>100)return say('Remove a saved loop first (100 per song).');remember({loops:saved});renderSavedLoops();}),list);
    renderSavedLoops();
    const shortcuts=card('Keyboard shortcuts');shortcuts.append(el('p','These shortcuts work while Spotify is focused. Select a field and press a key combination. Backspace clears it.'));
    const fields={};
    for(const [action,label]of Object.entries(shortcutLabels)){
      const input=el('input',undefined,'le-input');input.readOnly=true;input.value=state.settings.bindings[action];input.setAttribute('aria-label',label+' shortcut');fields[action]=input;
      input.onkeydown=event=>{if(event.key==='Tab')return;event.preventDefault();event.stopPropagation();if(['Control','Alt','Shift','Meta'].includes(event.key))return;const value=event.key==='Backspace'?'':Core.binding(event);try{const bindings=Core.validateBindings({...state.settings.bindings,[action]:value});if(save({...state,settings:{...state.settings,bindings}}))input.value=value;}catch(e){say(e.message);}};row(shortcuts,label,input);
    }
    shortcuts.append(button('Reset shortcuts',()=>{if(save({...state,settings:{...state.settings,bindings:Core.defaultBindings()}}))for(const key of Object.keys(fields))fields[key].value=state.settings.bindings[key];}));
    const compatibilityCard=card('Version & compatibility');const info=el('p');info.dataset.leCompatibility='';compatibilityCard.append(info,button('Refresh connection',()=>{bridgeLast=0;syncDesktop();}));
  }
  function renderSavedLoops(){
    const list=document.querySelector('[data-le-saved-loops]');if(!list)return;list.replaceChildren();
    const saved=state.tracks[currentUri]?.loops||[];
    if(!saved.length)list.append(el('p','No saved loops for the current song.'));
    saved.forEach((entry,index)=>{const r=el('div',undefined,'le-item');r.append(el('span',`${entry.name} · ${Core.format(entry.a)} → ${Core.format(entry.b)}`),button('Loop',async()=>{loop={uri:currentUri,a:entry.a,b:entry.b,active:false};const selected=loop;if(player.getState()?.isPaused)await player.resume({featureIdentifier:'local_enhancer'});await seek(entry.a);if(loop===selected){loop.active=true;lastSeek=Date.now();loopStatus();}}),button('Remove',()=>{remember({loops:saved.filter((_,i)=>i!==index)});renderSavedLoops();}));list.append(r);});
  }
  function volumeControl(){const input=document.querySelector('[data-testid="volume-bar"] input');if(!input)return null;return {input,value:Number(input.value),max:Number(input.max)||1};}
  function writeVolume(value){const control=volumeControl();if(!control)throw Error('Spotify volume control is unavailable.');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(control.input,String(value));control.input.dispatchEvent(new Event('input',{bubbles:true}));control.input.dispatchEvent(new Event('change',{bubbles:true}));}
  function cancelSleep(){sleepAt=null;endOfSong=null;if(fade){const old=fade;fade=null;try{writeVolume(old.volume);}catch{}}within('[data-le-sleep-status]').textContent='Timer off';}
  async function finishSleep(){sleepAt=null;endOfSong=null;if(loop)loop.active=false;loopStatus();await player.pause();if(fade){const old=fade;fade=null;writeVolume(old.volume);}say('Sleep timer finished.');within('[data-le-sleep-status]').textContent='Finished · playback paused';}
  function sleepTick(){
    const playing=player.getState(),timer=Core.sleepStatus({deadline:sleepAt,endingUri:endOfSong?.uri||null,fadeMs:fade?.duration||0},{uri:currentUri,position:progress(),duration:playing.duration||0,now:Date.now()});if(endOfSong){
      within('[data-le-sleep-status]').textContent='Stop after current song';
      // Pause just before the boundary; URI changes also trigger an immediate pause.
      if(timer.stop){finishSleep().catch(e=>say(e.message));return;}
    }
    if(sleepAt!==null){const left=timer.remaining;within('[data-le-sleep-status]').textContent=Core.format(left)+' remaining';
      if(fade&&left<=fade.duration){try{writeVolume(fade.volume*timer.factor);}catch(e){say(e.message);fade=null;}}
      if(timer.stop)finishSleep().catch(e=>say(e.message));
    }
  }
  async function exportBackup(){let desktop=null;try{desktop=await desktopRequest('/library');}catch{}download('myify-backup.json',JSON.stringify({...state,...(desktop?{desktopLibrary:desktop}:{})},null,2));say(desktop?'Backup includes settings, lyrics, loops, bookmarks and desktop file mappings.':'Settings backed up. Desktop tools were unavailable; their library mappings were not included.');}
  function extraTick(){
    syncDesktop();sleepTick();
    const info=document.querySelector('[data-le-compatibility]');if(info){const c=compatibility;info.textContent=`Myify 0.4.0 · Tested Spotify 1.3.5.3058. ${desktopConnected?'Desktop tools connected.':'Desktop tools disconnected.'} ${c?`Installed Spotify: ${c.installedSpotify} · ${c.supported?'Supported':'Compatibility not confirmed'}.`:''}`;}
    document.querySelectorAll('[data-le-generation]').forEach(node=>{node.textContent=desktopConnected?desktopStatus:'';});
    if(window._myifyLoopUri!==currentUri){window._myifyLoopUri=currentUri;renderSavedLoops();}
  }
  style.textContent+='.le-editor{width:min(1000px,95vw);max-height:90vh;background:var(--background-elevated-base,#282828);color:var(--text-base,#fff);border:1px solid #ffffff55;border-radius:12px;padding:24px}.le-editor::backdrop{background:#0009}.le-editor-lines{max-height:45vh;overflow:auto;margin:16px 0}.le-editor-line{flex-wrap:nowrap;padding:6px 0}.le-editor-line[data-next]{outline:2px solid var(--essential-bright-accent,#1ed760);outline-offset:-2px}.le-editor h2{font-size:22px;margin-bottom:12px}';
  within('[data-le-file]').append(button('Lyrics editor',openEditor),button('Generate lyrics',()=>openDesktop('generate')),button('Mini-player',()=>openDesktop('mini')));
  const generationStatus=el('p');generationStatus.dataset.leGeneration='';within('[data-le-file]').append(generationStatus);
  within('[data-le-timer]').append(button('Stop after song',()=>{if(!playable(currentUri))return say('Choose a song first.');cancelSleep();if(loop)loop.active=false;endOfSong={uri:currentUri};say('Playback will stop at the end of this song.');}),button('Fade timer',()=>{const minutes=Number(within('[data-le-minutes]').value);if(!Number.isFinite(minutes)||minutes<1||minutes>240)throw Error('Choose 1–240 minutes.');const volume=volumeControl();if(!volume)throw Error('Open Spotify’s volume controls first.');cancelSleep();fade={volume:volume.value,duration:Math.min(30000,minutes*60000)};sleepAt=Date.now()+minutes*60000;say('Timer started; volume fades over the final 30 seconds.');}));
