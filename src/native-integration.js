/* Version-bound integration for Spotify Windows 1.3.5.3058.
 * Uses the installed renderer; does not contain Spotify's recovered code.
 */
(() => {
  'use strict';
  if (window.SpotifyNativeEnhancer) return;
  const Core = window.LocalEnhancerCore, KEY = 'local-enhancer:v1';
  const Backgrounds=window.MyifyBackgrounds;
  if (!Core) throw Error('Enhancer core was not loaded.');
  let state = Core.emptyState();
  try { const saved = localStorage.getItem(KEY); if (saved) state = Core.validateState(JSON.parse(saved)); } catch (e) { console.warn('Enhancer saved data could not load:', e.message); }
  const listeners = new Set(); let revision = 0, player, registry, platform, requireModule, currentUri = '', loop = null, sleepAt = null, lastSeek = 0;
  let status = 'Enhancements ready', lastRender = '', selectedTarget = '', returnFocus = null,seekPending=false;
  const local = uri => typeof uri === 'string' && uri.startsWith('spotify:local:');
  const playable=uri=>Core.validUri(uri)&&!uri.startsWith('spotify:playlist:');
  const record = uri => playable(uri) && state.tracks[uri]?.raw ? state.tracks[uri] : null;
  function palette(){const t=Core.defaultTheme();if(state.settings.theme==='midnight')return{...t,name:'Midnight blue',background:'#101a2b',panel:'#1a2940',accent:'#a6c8ff',lyricsBackground:'#1a2940'};if(state.settings.theme==='plum')return{...t,name:'Plum',background:'#231625',panel:'#35203b',accent:'#f1b1eb',lyricsBackground:'#35203b'};return state.settings.theme==='custom'?state.settings.customTheme:t;}
  function notify() { revision++; listeners.forEach(fn => fn()); lastRender = ''; }
  function save(next) { try { next.modifiedAt=Date.now();localStorage.setItem(KEY, JSON.stringify(next)); state = next; notify();bridgeLast=0;syncDesktop();return true; } catch { say('Storage is full. Export a backup before removing unused lyrics.'); return false; } }
  function say(text) { status = text; document.querySelectorAll('[data-le-status]').forEach(e => { e.textContent = text; }); }
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const snapshot = () => revision;
  const parsedCache = new Map();
  function localData(uri) {
    const rec = record(uri); if (!rec) return null;
    const colors=palette(),key = `${uri}\n${rec.offset}\n${rec.raw}\n${JSON.stringify(colors)}`;
    if (parsedCache.has(key)) return parsedCache.get(key);
    const parsed = Core.parseLrc(rec.raw), delay = parsed.offset + (rec.offset || 0);
    const lyrics = parsed.lines.map((line, index) => ({ start: line.ms + delay, end: parsed.lines[index + 1] ? parsed.lines[index + 1].ms + delay : Infinity, text: line.text }));
    const data = { hasLyrics: true, isTimeSynced: true, syncType: 'LINE_SYNCED', lyrics, previewLines: lyrics, colors: { text: colors.lyricsText+'73', activeText:colors.lyricsText,background:colors.lyricsBackground }, dynamicColors: null, provider: 'local-lrc', providerDisplayName: `Imported .lrc · ${rec.file || 'Your lyrics file'}`, providerLyricsId: uri, hasVocalRemoval: false, showUpsell: false, alternatives: [], capStatus: 'NOT_CAPPED' };
    if (parsedCache.size > 10) parsedCache.clear(); parsedCache.set(key, data); return data;
  }
  function wrapFactory(id, exportName, wrapper) {
    const factories = typeof __webpack_modules__ === 'object' ? __webpack_modules__ : null;
    if (!factories || typeof factories[id] !== 'function') throw Error(`Spotify module ${id} is unavailable.`);
    const original = factories[id];
    factories[id] = function(module, exports, req) {
      const captured = {}, capturedModule = { ...module, exports: captured };
      original.call(captured, capturedModule, captured, req);
      for (const name of Object.keys(capturedModule.exports)) {
        Object.defineProperty(exports, name, { enumerable: true, get: name === exportName ? () => wrapper(capturedModule.exports[name], req) : () => capturedModule.exports[name] });
      }
    };
  }
  // Original hooks always run. Only text explicitly imported by the user replaces
  // a lyric result. Unattached catalog lyrics and account behavior stay native.
  const hookCache = new WeakMap();
  function hook(original, req, availability) {
    if (hookCache.has(original)) return hookCache.get(original);
    const React = req(62515);
    const wrapped = (...args) => {
      React.useSyncExternalStore(subscribe, snapshot, snapshot);
      const native = original(...args), data = localData(args[0]);
      return data ? availability ? { hasLyrics: true, isLoading: false } : { data, loading: false, error: false } : native;
    };
    hookCache.set(original, wrapped); return wrapped;
  }
  try {
    wrapFactory(91243, 'I', (fn, req) => hook(fn, req, false));
    wrapFactory(48071, 'f', (fn, req) => hook(fn, req, true));
  } catch (e) { console.error('Enhancer native lyrics initialization failed:', e); return; }
  (window.rspackChunk ||= []).push([['spotify-local-enhancer-bootstrap'], {}, req => { requireModule = req; }]);
  function bind() {
    const main = document.querySelector('main'); if (!main || !requireModule) return false;
    const fiberKey = Object.keys(main).find(k => k.startsWith('__reactFiber'));
    for (let fiber = main[fiberKey]; fiber; fiber = fiber.return) {
      const value = fiber.memoizedProps?.value;
      if (typeof value?.resolve === 'function') registry = value;
      if (typeof value?.getHistory === 'function') platform = value;
    }
    if (!registry) return false;
    player = registry.resolve(Symbol.for('PlayerAPI'));
    window.SpotifyNativeEnhancer.playerBound = !!player;
    return !!player;
  }
  function current() { return player?.getState()?.item; }
  function progress() { const s = player?.getState(); return s ? requireModule(37438).s(s) || 0 : 0; }
  async function seek(ms) {
    const before=player.getState(),uri=before?.item?.uri;
    if(!playable(uri))throw Error('Choose a song, local file, podcast or audiobook chapter first.');
    if(before.restrictions?.canSeek===false)throw Error('Spotify cannot seek this item: '+(before.restrictions.disallowSeekingReasons?.join(', ')||'playback restriction'));
    const target=Math.round(Math.max(0,Math.min((before.duration||Infinity)-100,ms)));
    if(seekPending)throw Error('Wait for the previous seek to finish.');seekPending=true;
    async function acknowledged(){for(let i=0;i<12;i++){if(current()?.uri!==uri)throw Error('Playback changed before the seek finished.');if(Math.abs(progress()-target)<1200)return true;await new Promise(r=>setTimeout(r,100));}return false;}
    try{
      await player.seekTo(target);
      if(await acknowledged())return;
      // A newly selected, paused local file may not have a decoder yet. Prepare
      // it through its local collection, rather than treating the URI as a stream.
      if(local(uri)){
        const volumeInput=document.querySelector('[data-testid="volume-bar"] input'),muteButton=document.querySelector('[data-testid="volume-bar-toggle-mute-button"]');
        const mustSilence=before.isPaused&&volumeInput&&Number(volumeInput.value)>0;
        if(before.isPaused&&!volumeInput)throw Error('Open the normal Spotify player controls so the local file can be prepared silently.');
        let silenced=false;
        try{
          if(mustSilence){if(!muteButton)throw Error('Spotify volume control is unavailable.');muteButton.click();silenced=true;await new Promise(r=>setTimeout(r,100));}
          await player.play({uri:'spotify:local-files'},{featureIdentifier:'local_enhancer'},{skipTo:{uri,uid:before.item.uid},seekTo:target,paused:false,shuffle:before.shuffle,repeat:before.repeat});
          for(let i=0;i<20;i++){const s=player.getState();if(s?.item?.uri===uri&&!s.isPaused&&!s.isBuffering&&s.timestamp!==before.timestamp)break;await new Promise(r=>setTimeout(r,100));}
          await player.seekTo(target);
          if(await acknowledged())return;
        }finally{
          try{if(before.isPaused&&current()?.uri===uri){await player.pause();for(let i=0;i<10&&!player.getState()?.isPaused;i++)await new Promise(r=>setTimeout(r,100));}}
          finally{if(silenced&&Number(document.querySelector('[data-testid="volume-bar"] input')?.value)===0)document.querySelector('[data-testid="volume-bar-toggle-mute-button"]')?.click();}
        }
      }
      throw Error('Spotify did not move to the requested position. Start playback and try again.');
    }finally{seekPending=false;}
  }
  function navigate(path) { platform?.getHistory().push(path); }
  function download(name, content) { const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
  function artist(item) { return item?.artists?.map(a => a.name).join(', ') || ''; }
  function remember(patch, uri = currentUri) {
    const item = current(); if (!playable(uri)) return say('Choose a playable item first.');
    const next = { ...state.tracks[uri], title: item?.name || 'Local song', artist: artist(item), raw: '', offset: 0, ...state.tracks[uri], ...patch };
    return save({ ...state, tracks: { ...state.tracks, [uri]: next } });
  }
  function el(tag, text, cls) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (cls) element.className = cls; return element; }
  function button(text, action, primary = false) { const b = el('button', text, primary ? 'le-button le-primary' : 'le-button'); b.type = 'button'; b.onclick = () => {try{const result=action();if(result?.catch)result.catch(e=>say(e.message));}catch(e){say(e.message);}}; return b; }
  const style = document.createElement('style'); style.id = 'spotify-native-enhancer-css'; style.textContent = `
    .le-button{font-family:inherit;font-size:14px;font-weight:700;color:var(--text-base,#fff);background:transparent;border:1px solid #ffffff55;border-radius:999px;min-height:32px;padding:6px 15px;cursor:pointer;white-space:nowrap}.le-button:hover{border-color:#fff;transform:scale(1.02)}.le-button:focus-visible,.le-input:focus-visible{outline:2px solid var(--essential-bright-accent,#1ed760);outline-offset:3px}.le-primary{background:var(--essential-bright-accent,#1ed760);color:#000;border-color:transparent}.le-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.le-card{margin:20px 0 28px;padding:24px 0;border-top:1px solid #ffffff25}.le-card h2{font-size:22px;font-weight:700;margin:0 0 16px}.le-card p,.le-subtle{font-size:14px;color:var(--text-subdued,#b3b3b3);line-height:1.5}.le-input{font:inherit;border:1px solid #ffffff55;border-radius:4px;background:var(--background-highlight,#282828);color:var(--text-base,#fff);padding:8px 10px;max-width:100%}.le-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #ffffff15}.le-item>div{min-width:0}.le-item strong{display:block}.le-card label,.le-popover label{display:inline-flex;align-items:center;gap:8px;font-size:14px}.le-popover{position:fixed;right:24px;bottom:96px;z-index:1000;width:360px;max-height:75vh;overflow:auto;background:var(--background-elevated-base,#282828);color:var(--text-base,#fff);border-radius:8px;box-shadow:0 16px 24px #0008;padding:20px;font-family:inherit}.le-popover[hidden]{display:none}.le-popover h3{font-size:18px;margin:0 0 14px}.le-popover p{font-size:13px;color:var(--text-subdued,#b3b3b3);line-height:1.5;margin:10px 0}.le-popover hr{border:0;border-top:1px solid #ffffff20;margin:16px 0}.le-player-button{height:32px;width:32px;border:0;background:none;color:var(--text-subdued,#b3b3b3);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:6px}.le-player-button:hover{color:#fff}.le-player-button svg{width:20px;height:20px;fill:currentColor}.le-toolbar{padding:12px 24px;background:var(--background-base,#121212);border-bottom:1px solid #ffffff20;position:relative;z-index:3}.le-toolbar span{font-size:12px;color:var(--text-subdued,#b3b3b3)}.le-import-row{margin:10px 0 20px}.le-settings{padding:0 32px 32px;max-width:1100px}.le-status{font-size:12px;color:var(--text-subdued,#b3b3b3)}.le-toolbar input{width:100px}.le-pair{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0}.le-list{max-height:420px;overflow:auto}.le-list .le-button{font-size:12px}.le-now-file{display:block;max-width:290px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    [data-le-theme=midnight] .Root__main-view,[data-le-theme=midnight] .Root__right-sidebar,[data-le-theme=midnight] .Root__nav-bar{--background-base:#101a2b;--background-elevated-base:#1a2940;background-color:#101a2b}
    [data-le-theme=plum] .Root__main-view,[data-le-theme=plum] .Root__right-sidebar,[data-le-theme=plum] .Root__nav-bar{--background-base:#231625;--background-elevated-base:#35203b;background-color:#231625}
    [data-le-lyric-size] [data-testid=lyrics-line]{font-size:var(--le-lyric-size)!important}
  `;
  style.textContent += '.le-toolbar{grid-area:1/1/-1/-1;align-self:start;position:sticky;top:0;width:100%;background:var(--lyrics-color-background,#121212)}';
  style.textContent += '[data-le-theme=midnight] main,[data-le-theme=midnight] .main-view-container__scroll-node-child{background-color:#101a2b!important}[data-le-theme=plum] main,[data-le-theme=plum] .main-view-container__scroll-node-child{background-color:#231625!important}';
  const themeStyle=document.createElement('style');themeStyle.id='spotify-enhancer-custom-theme';
  function appearance() {
    document.documentElement.dataset.leTheme=state.settings.theme;document.documentElement.dataset.leLyricSize='true';document.documentElement.style.setProperty('--le-lyric-size',`${state.settings.fontSize}px`);
    if(!themeStyle.isConnected&&document.head)document.head.append(themeStyle);
    const t=palette();
    themeStyle.textContent=state.settings.theme==='forest'?'':`html{--background-base:${t.background};--background-elevated-base:${t.panel};--background-highlight:${t.panel};--text-base:${t.text};--text-subdued:${t.muted};--essential-bright-accent:${t.accent};--text-bright-accent:${t.accent}}html main,html .main-view-container__scroll-node-child{background-color:${t.background}!important;color:${t.text}}html [data-testid="global-nav-bar"],html [data-testid="now-playing-bar"]{background-color:${t.panel}!important}html main [data-encore-id="text"],html .le-settings,html .le-popover{color:${t.text}}html .le-primary{background:${t.accent};color:#101010}html .le-popover,html .le-input{background-color:${t.panel};color:${t.text}}html .le-subtle,html .le-status,html .le-card p,html .le-popover p{color:${t.muted}}`;
    parsedCache.clear();
    const font=JSON.stringify(Backgrounds.fontFamily(t.fontFamily)||'Segoe UI')+',"Segoe UI Emoji",sans-serif';
    if(t.fontFamily&&t.fontFamily!=='System')themeStyle.textContent+=`html{--encore-body-font-stack:${font};--encore-title-font-stack:${font}}html body,html body :is(main,button,input,textarea,select,a,p,span,strong,b,em,h1,h2,h3,h4,h5,h6,label,div,td,th,li){font-family:${font}!important}`;
    const backgroundUrl=Backgrounds.getUrl(t.backgroundImage);
    if(backgroundUrl)themeStyle.textContent+=`html main,html .main-view-container__scroll-node-child{background-image:linear-gradient(#0007,#0007),url("${backgroundUrl}")!important;background-size:cover!important;background-position:center!important;background-attachment:fixed!important}`;
  }
  const fileInput = el('input'); fileInput.id='spotify-native-enhancer-lrc-file'; fileInput.type = 'file'; fileInput.accept = '.lrc'; fileInput.hidden = true;
  fileInput.onchange = async () => {
    const file = fileInput.files[0], uri = selectedTarget; fileInput.value = ''; if (!file) return;
    try {
      if (!playable(uri)) throw Error('Select a song, local file, podcast or chapter.');
      if (file.size > 512 * 1024 || !/\.lrc$/i.test(file.name)) throw Error('Choose a .lrc file smaller than 512 KB.');
      const raw = await file.text(); if (!Core.parseLrc(raw).lines.length) throw Error('No timed lyric lines were found.');
      if (currentUri !== uri) throw Error('Song changed. Choose the lyrics file again.');
      if (remember({ raw, file: file.name, offset: 0 }, uri)) { say('Local lyrics saved.'); navigate('/lyrics'); }
    } catch (e) { say(e.message); }
  };
  function importLyrics() { if (!playable(currentUri)) return say('Choose a song, local file, podcast or chapter first.'); selectedTarget = currentUri; fileInput.click(); }
  function addBookmark() {
    const item = current(); if (!Core.validUri(item?.uri)) return say('Play a song first.');
    if (state.bookmarks.length >= 2000) return say('Export a backup and remove older bookmarks first.');
    const b = { id: crypto.randomUUID(), uri: item.uri, title: item.name, ms: Math.round(progress()), note: '' };
    if (save({ ...state, bookmarks: [...state.bookmarks, b] })) say(`Bookmarked ${Core.format(b.ms)}.`);
  }
  const popover = el('section', undefined, 'le-popover'); popover.id = 'spotify-native-enhancer-tools'; popover.hidden = true; popover.setAttribute('aria-label', 'Playback tools');
  popover.innerHTML = '<div class="le-row" style="justify-content:space-between"><h3>Playback tools</h3><button class="le-button" data-action="close" aria-label="Close playback tools">×</button></div><p class="le-now-file" data-le-now></p><div class="le-row" data-le-actions></div><hr><div class="le-row" data-le-loop></div><p data-le-loop-status>Loop off</p><hr><label>Sleep in <input class="le-input" type="number" data-le-minutes min="1" max="240" value="30" style="width:72px"> minutes</label><div class="le-row" data-le-timer style="margin-top:12px"></div><p data-le-sleep-status>Timer off</p><hr><div class="le-row" data-le-file></div><hr><div class="le-row" data-le-settings-link></div><p data-le-status role="status"></p>';
  const within = selector => popover.querySelector(selector);
  function close() { popover.hidden = true; returnFocus?.focus(); }
  function open() { returnFocus = document.activeElement; popover.hidden = false; within('[data-le-now]').textContent = current()?.name || 'No song selected'; within('[data-le-status]').textContent = status; within('[data-action=close]').focus(); }
  within('[data-action=close]').onclick = close;
  within('[data-le-actions]').append(button('−10 s', () => seek(progress() - 10000)), button('Bookmark', addBookmark), button('+10 s', () => seek(progress() + 10000)));
  within('[data-le-loop]').append(button('Set A', () => { if (!playable(currentUri))return say('Choose a playable item first.'); loop = { uri: currentUri, a: progress(), b: null,active:false }; loopStatus();say('A saved. Move forward, then choose Set B to start looping.'); }), button('Set B', async () => {
    const b=progress();if(!loop){within('[data-le-loop-status]').textContent='Set A first.';return say('Set A first.');}
    if(b-loop.a<500){within('[data-le-loop-status]').textContent='B must be at least 0.5 seconds after A.';return say('Move past A, then set B.');}
    const selected=loop;selected.b=b;selected.active=false;loopStatus();say('Starting loop…');
    try{if(player.getState()?.isPaused){await player.resume({featureIdentifier:'local_enhancer'});await new Promise(r=>setTimeout(r,200));}if(loop!==selected)return;await seek(selected.a);if(loop!==selected)return;selected.active=true;lastSeek=Date.now();loopStatus();say('Loop active. Clear stops looping.');}catch(e){selected.active=false;loopStatus();say('Loop could not start: '+e.message);}
  }), button('Clear', () => { loop = null; loopStatus();say('Loop cleared.'); }));
  function loopStatus() { within('[data-le-loop-status]').textContent = loop ? `A ${Core.format(loop.a)}${loop.b === null ? ' · set B next' : ' → B ' + Core.format(loop.b)+(loop.active?' · Looping':' · Ready')}` : 'Loop off'; }
  within('[data-le-timer]').append(button('Start timer', () => { const minutes = Number(within('[data-le-minutes]').value); if (minutes < 1 || minutes > 240 || !Number.isFinite(minutes)) return say('Choose 1–240 minutes.'); cancelSleep();sleepAt = Date.now() + minutes * 60000; say('Sleep timer started.'); }), button('Cancel', cancelSleep));
  within('[data-le-file]').append(button('Import .lrc', importLyrics), button('Open lyrics', () => { navigate('/lyrics'); close(); }));
  within('[data-le-settings-link]').append(button('Settings & bookmarks', () => { navigate('/preferences'); close(); setTimeout(() => document.getElementById('spotify-native-enhancer-settings')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 800); }));
  function row(container, label, control) { const r = el('div', undefined, 'le-pair'); r.append(el('span', label), control); container.append(r); }
  /* MYIFY_THEME_EDITOR */
  function settings() {
    if (document.getElementById('spotify-native-enhancer-settings')) return;
    const main = document.querySelector('main'); if (!main) return;
    const section = el('section', undefined, 'le-settings'); section.id = 'spotify-native-enhancer-settings';
    const card = title => { const c = el('div', undefined, 'le-card'); c.append(el('h2', title)); section.append(c); return c; };
    const intro = card('Myify'); intro.append(el('p', 'Imported lyrics use Spotify’s original lyric view. Your files, bookmarks and appearance stay on this computer.'));
    const buttons = el('div', undefined, 'le-row le-import-row'); buttons.append(button('Import .lrc for current item', importLyrics, true), button('Open lyrics', () => navigate('/lyrics')), button('Playback tools', open)); intro.append(buttons);
    mountThemeEditor(card('Theme editor'));
    const notes = card('Playback bookmarks'), noteList = el('div', undefined, 'le-list'); notes.append(button('Bookmark current position', addBookmark), noteList); noteList.dataset.leBookmarkList = '';
    const lyrics = card('Imported lyric files'), controls = el('div', undefined, 'le-row');
    const filter = el('input', undefined, 'le-input'); filter.placeholder = 'Filter title or artist'; filter.setAttribute('aria-label', 'Filter local lyric files');
    const sort = el('select', undefined, 'le-input'); for (const [value,label] of [['title','Title A–Z'],['artist','Artist A–Z']]) { const o = el('option',label); o.value = value; sort.append(o); }
    const lyricList = el('div', undefined, 'le-list'); lyricList.dataset.leLyricList = ''; controls.append(filter, sort); lyrics.append(controls, lyricList);
    filter.oninput = () => renderLists(); sort.onchange = () => renderLists();
    section.dataset.leFilter = ''; section._leFilter = filter; section._leSort = sort;
    extraSettings(section,intro,card);
    const backup = card('Backup & restore'); backup.append(el('p', 'Backups include lyric attachments, saved loops, bookmarks, themes and keyboard bindings. Desktop library mappings are included while desktop tools are connected. Music files and model weights are not copied.'));
    const backupRow = el('div', undefined, 'le-row'); const restore = el('input'); restore.type = 'file'; restore.accept = '.json'; restore.hidden = true;
    restore.onchange = async () => { const f = restore.files[0]; restore.value = ''; if (!f) return; try { if (f.size > 128*1024*1024) throw Error('Backup must be under 128 MB.'); const raw=JSON.parse(await f.text()),other = Core.validateState(raw); await Backgrounds.importAssets(raw.backgroundAssets||[]); const bookmarks = new Map(state.bookmarks.map(b=>[b.id,b])); other.bookmarks.forEach(b=>bookmarks.set(b.id,b)); if (bookmarks.size > 2000) throw Error('Too many bookmarks.'); if (save({ ...state, tracks: { ...state.tracks, ...other.tracks }, bookmarks: [...bookmarks.values()], settings: other.settings })) { appearance();if(raw.desktopLibrary){try{await desktopRequest('/restore',raw.desktopLibrary);}catch{say('Settings restored. Launch desktop tools and import again to restore local file mappings.');return;}}say('Backup imported.');section.remove();settings(); } } catch (e) { say(e.message); } };
    backupRow.append(button('Export backup', exportBackup), button('Import backup', () => restore.click()), restore); backup.append(backupRow);
    const statusEl = el('p', status, 'le-status'); statusEl.dataset.leStatus = ''; statusEl.setAttribute('role','status'); section.append(statusEl);
    const content = main.querySelector('.contentSpacing') || main; content.append(section); renderLists();renderSavedLoops();
  }
  async function playBookmark(b) { try { if (currentUri !== b.uri) { await player.play({ uri: local(b.uri)?'spotify:local-files':b.uri }, { featureIdentifier: 'local_enhancer' }, local(b.uri)?{skipTo:{uri:b.uri}}:{}); const end = Date.now()+8000; while(current()?.uri !== b.uri && Date.now()<end) await new Promise(r=>setTimeout(r,100)); if (current()?.uri !== b.uri) throw Error('Song did not load.'); } await seek(b.ms); } catch(e) { say(e.message); } }
  function renderLists() {
    const section = document.getElementById('spotify-native-enhancer-settings'); if (!section) return;
    const bookmarks = section.querySelector('[data-le-bookmark-list]'); bookmarks.replaceChildren();
    for(const b of [...state.bookmarks].reverse()) { const r=el('div',undefined,'le-item'), info=el('div'), actions=el('div',undefined,'le-row');info.append(el('strong',b.title),el('small',`${Core.format(b.ms)}${b.note?' · '+b.note:''}`));actions.append(button('Play',()=>playBookmark(b)),button('Note',()=>{const note=prompt('Bookmark note',b.note||'');if(note!==null)save({...state,bookmarks:state.bookmarks.map(x=>x.id===b.id?{...x,note:note.slice(0,500)}:x)});}),button('Remove',()=>save({...state,bookmarks:state.bookmarks.filter(x=>x.id!==b.id)})));r.append(info,actions);bookmarks.append(r); }
    if(!state.bookmarks.length)bookmarks.append(el('p','No bookmarks saved yet.'));
    const list=section.querySelector('[data-le-lyric-list]');list.replaceChildren();const term=section._leFilter.value.toLowerCase(),sort=section._leSort.value;
    const tracks=Object.entries(state.tracks).filter(([uri,t])=>playable(uri)&&t.raw&&`${t.title} ${t.artist}`.toLowerCase().includes(term)).sort(([,a],[,b])=>String(a[sort]||'').localeCompare(String(b[sort]||'')));
    for(const [uri,t] of tracks){const r=el('div',undefined,'le-item'),info=el('div'),actions=el('div',undefined,'le-row');info.append(el('strong',t.title),el('small',`${t.artist} · ${t.file||'Imported lyrics'} · ${t.offset||0} ms`));actions.append(button('Play',()=>playBookmark({uri,ms:0})),button('Export .lrc',()=>download(t.file||'lyrics.lrc',t.raw)),button('Remove',()=>save({...state,tracks:{...state.tracks,[uri]:{...t,raw:'',file:''}}})));r.append(info,actions);list.append(r);}
    if(!tracks.length)list.append(el('p','No matching local lyric files.'));
  }
  function mountToolbar() {
    if(!playable(currentUri))return;
    const container = document.querySelector('main .wYWhVPZoG93lR7ogMIug'); if(!container || container.querySelector('.le-toolbar'))return;
    const toolbar=el('div',undefined,'le-toolbar le-row');toolbar.append(button(record(currentUri)?'Replace .lrc':'Import .lrc',importLyrics,true));
    const label=el('label', 'Delay (ms) '),input=el('input',undefined,'le-input'); input.type='number';input.step='100';input.min='-600000';input.max='600000';input.value=state.tracks[currentUri]?.offset||0;
    input.onchange=()=>{const offset=Number(input.value);if(!Number.isFinite(offset)||Math.abs(offset)>600000)return say('Delay must be within ±600000 ms.');if(remember({offset}))say('Lyric delay saved.');};label.append(input);toolbar.append(label,button('Playback tools',open),el('span',record(currentUri)?.file||'Attach your own synchronized lyrics'));container.prepend(toolbar);
  }
  /* MYIFY_FEATURES */
  function tick() {
    try {
      if(!player&&!bind())return;
      if(!document.getElementById(style.id)){document.head.append(style);document.body.append(fileInput,popover);appearance();}
      const item=current(),uri=item?.uri||'';
      if(uri!==currentUri){currentUri=uri;loop=null;loopStatus();document.querySelectorAll('.le-toolbar').forEach(e=>e.remove());lastRender='';}
      const controls=document.querySelector('[data-testid="now-playing-bar"] [data-testid="lyrics-button"]')?.parentElement||document.querySelector('[data-testid="now-playing-bar"] [data-testid="general-controls"]');
      if(controls&&!document.getElementById('spotify-native-enhancer-button')){const b=button('',()=>popover.hidden?open():close());b.id='spotify-native-enhancer-button';b.className='le-player-button';b.title='Myify: playback tools & local lyrics';b.setAttribute('aria-label',b.title);b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 6h9V4h2v2h5v2h-5v2h-2V8H4zm0 10h3v-2h2v2h11v2H9v2H7v-2H4zm0-5h13V9h2v2h1v2h-1v2h-2v-2H4z"/></svg>';controls.prepend(b);}
      const toolButton=document.getElementById('spotify-native-enhancer-button');if(controls&&toolButton&&toolButton.parentElement!==controls)controls.prepend(toolButton);
      mountToolbar();
      const route=platform?.getHistory().location.pathname||location.pathname;
      if(route==='/preferences')settings();else document.getElementById('spotify-native-enhancer-settings')?.remove();
      const renderKey=route+'|'+currentUri+'|'+revision;if(renderKey!==lastRender){renderLists();lastRender=renderKey;}
      if(loop?.active&&loop.uri===currentUri&&loop.b!==null&&!player.getState()?.isPaused&&!seekPending&&progress()>=loop.b&&Date.now()-lastSeek>500){lastSeek=Date.now();const selected=loop;seek(loop.a).catch(e=>{if(loop===selected){selected.active=false;loopStatus();}say('Loop stopped: '+e.message);});}
      extraTick();
    }catch(e){console.warn('Enhancer update:',e.message);}
  }
  document.addEventListener('keydown',handleShortcut);
  window.addEventListener('storage',e=>{if(e.key===KEY){try{state=e.newValue?Core.validateState(JSON.parse(e.newValue)):Core.emptyState();notify();appearance();}catch{}}});
  window.SpotifyNativeEnhancer={version:'0.4.3',playerBound:false,openTools:open,openSettings:()=>navigate('/preferences'),openEditor,getStatus:()=>({version:'0.4.3',uri:currentUri,localLyrics:!!record(currentUri),hookedModules:[91243,48071],playerBound:!!player,desktopConnected,compatibility,loop:loop?{a:loop.a,b:loop.b,active:loop.active}:null}),refresh:notify};
  setInterval(tick,200);
  Backgrounds.subscribe(()=>{appearance();notify();});
})();
