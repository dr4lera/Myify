/* Myify. No remote scripts, analytics, or subscription changes. */
(function (root) {
  'use strict';
  const VERSION = 1, KEY = 'local-enhancer:v1';
  const MAX_FILE = 512 * 1024;
  const validUri = value => typeof value === 'string' && /^spotify:(local|track|episode|chapter|playlist):[^\s]+$/.test(value);
  const defaultTheme = () => ({name:'My theme',background:'#121212',panel:'#181818',text:'#ffffff',muted:'#b3b3b3',accent:'#1ed760',lyricsBackground:'#1e5a3c',lyricsText:'#ffffff',fontFamily:'System',fontName:'',backgroundImage:''});
  function validateTheme(value) {
    if(!value || typeof value !== 'object') throw Error('Invalid theme.');
    const theme=defaultTheme();theme.name=String(value.name||theme.name).slice(0,60);
    for(const key of ['background','panel','text','muted','accent','lyricsBackground','lyricsText']){
      if(typeof value[key] !== 'undefined' && !/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Theme colors must use #RRGGBB.');
      if(value[key])theme[key]=value[key].toLowerCase();
    }
    theme.fontFamily=['System','Segoe UI','Arial','Georgia','Consolas'].includes(value.fontFamily)||/^myify-font:[a-f0-9]{64}$/.test(value.fontFamily)?value.fontFamily:'System';
    theme.fontName=theme.fontFamily.startsWith('myify-font:')?String(value.fontName||'Custom font').slice(0,100):'';
    const image=value.backgroundImage||'';
    if(typeof image!=='string'||(image&&!/^myify-image:[a-f0-9]{64}$/.test(image)&&(!/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)||image.length>12*1024*1024)))throw Error('Unsupported background image. Choose a PNG, JPG, GIF or WebP file.');
    theme.backgroundImage=image.replace(/^data:image\/jpg;/i,'data:image/jpeg;');
    return theme;
  }
  function parseLrc(source) {
    const lines = [], meta = {};
    let offset = 0;
    for (const row of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const tag = row.match(/^\[(ar|ti|al|by|offset):([^\]]*)\]/i);
      if (tag) {
        if (tag[1].toLowerCase() === 'offset') offset = Number(tag[2]) || 0;
        else meta[tag[1].toLowerCase()] = tag[2].trim();
      }
      const stamps = [...row.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
      const text = row.replace(/\[\d+:[0-5]\d(?:[.:]\d{1,3})?\]/g, '').replace(/<\d+:[0-5]\d(?:\.\d+)?>/g, '').trim();
      for (const stamp of stamps) {
        const ms = Number(stamp[1]) * 60000 + Number(stamp[2]) * 1000 + Number((stamp[3] || '').padEnd(3, '0'));
        lines.push({ ms, text });
      }
    }
    lines.sort((a, b) => a.ms - b.ms);
    return { lines, meta, offset };
  }
  function activeLine(lines, position, offset = 0) {
    let low = 0, high = lines.length - 1, found = -1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (lines[mid].ms + offset <= position) { found = mid; low = mid + 1; }
      else high = mid - 1;
    }
    return found;
  }
  const defaultBindings=()=>({lyrics:'Alt+Shift+L',bookmark:'Alt+Shift+B',tools:'Alt+Shift+T',back:'Alt+Shift+ArrowLeft',forward:'Alt+Shift+ArrowRight',setA:'Alt+Shift+A',setB:'Alt+Shift+S',clearLoop:'Alt+Shift+C',editor:'Alt+Shift+E',stamp:'Alt+Shift+Enter',mini:'Alt+Shift+M',generate:'Alt+Shift+G',theme:'Alt+Shift+Y'});
  function binding(event){const key=event.key.length===1?event.key.toUpperCase():event.key;return [...(event.ctrlKey?['Ctrl']:[]),...(event.altKey?['Alt']:[]),...(event.shiftKey?['Shift']:[]),...(event.metaKey?['Meta']:[]),key].join('+');}
  function validateBindings(value={}){const result={...defaultBindings(),...value},seen=new Set();for(const key of Object.keys(result)){if(!(key in defaultBindings())){delete result[key];continue;}const v=result[key];if(typeof v!=='string'||(v!==''&&!/^(?:(?:Ctrl|Alt|Shift|Meta)\+)+(?:[A-Z0-9]|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Enter|Escape|F(?:[1-9]|1[0-2]))$/.test(v)))throw Error('Use a modifier and a letter, number, arrow, Enter or function key.');if(v&&seen.has(v))throw Error('Two actions cannot share the same shortcut.');if(v)seen.add(v);}return result;}
  function serializeLrc(lines,meta={},offset=0){const clean=x=>String(x||'').replace(/[\r\n\[\]]/g,'');return ['[ti:'+clean(meta.ti)+']','[ar:'+clean(meta.ar)+']','[offset:'+Math.round(offset)+']',...lines.map(l=>{if(!Number.isFinite(l.ms)||l.ms<0)throw Error('Every line needs a valid timestamp.');const cs=Math.round(l.ms/10);return `[${String(Math.floor(cs/6000)).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}]${String(l.text).replace(/[\r\n]/g,' ')}`;})].join('\n')+'\n';}
  function emptyState() { return { version: VERSION, tracks: {}, bookmarks: [], settings: { theme: 'forest', fontSize: 30, customTheme:validateTheme(defaultTheme()),savedThemes:[],bindings:defaultBindings() } }; }
  function validateState(value) {
    if (!value || value.version !== VERSION || !value.tracks || typeof value.tracks !== 'object' || Array.isArray(value.tracks) || !Array.isArray(value.bookmarks)) throw Error('This is not an Enhancer v1 backup.');
    const state = emptyState();
    if(Number.isFinite(value.modifiedAt)&&value.modifiedAt>=0)state.modifiedAt=value.modifiedAt;
    for (const [uri, track] of Object.entries(value.tracks)) {
      if (!validUri(uri) || !track || typeof track !== 'object') throw Error('Backup has an invalid song.');
      if (typeof track.raw !== 'undefined' && (typeof track.raw !== 'string' || track.raw.length > MAX_FILE)) throw Error('Invalid lyric data.');
      state.tracks[uri] = { title: String(track.title || 'Untitled').slice(0, 500), artist: String(track.artist || '').slice(0, 500), raw: track.raw || '', file: String(track.file || '').slice(0, 500), offset: Number.isFinite(track.offset) ? Math.max(-600000, Math.min(600000, track.offset)) : 0 };
      if(track.path)state.tracks[uri].path=String(track.path).slice(0,32768);
      if(Array.isArray(track.loops))state.tracks[uri].loops=track.loops.slice(0,100).map(l=>{if(!l||!Number.isFinite(l.a)||!Number.isFinite(l.b)||l.a<0||l.b-l.a<500)throw Error('Invalid saved loop.');return {name:String(l.name||'Loop').slice(0,100),a:l.a,b:l.b};});
    }
    for (const b of value.bookmarks.slice(0, 2000)) {
      if (!b || !validUri(b.uri) || !Number.isFinite(b.ms) || b.ms < 0) throw Error('Backup has an invalid bookmark.');
      state.bookmarks.push({ id: String(b.id).slice(0, 100), uri: b.uri, ms: b.ms, title: String(b.title || '').slice(0, 500), note: String(b.note || '').slice(0, 500) });
    }
    const s = value.settings || {};
    state.settings.theme = ['forest', 'midnight', 'plum','custom'].includes(s.theme) ? s.theme : 'forest';
    state.settings.fontSize = Number.isFinite(s.fontSize) ? Math.max(18, Math.min(48, s.fontSize)) : 30;
    state.settings.customTheme=validateTheme(s.customTheme||defaultTheme());
    state.settings.savedThemes=Array.isArray(s.savedThemes)?s.savedThemes.slice(0,30).map(validateTheme):[];
    state.settings.bindings=validateBindings(s.bindings);
    return state;
  }
  function format(ms) { const seconds = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  function sleepStatus(timer,playback){const remaining=timer.deadline===null?null:timer.deadline-playback.now;return {remaining,stop:!!timer.endingUri&&(playback.uri!==timer.endingUri||(playback.duration>0&&playback.position>=playback.duration-350))||(remaining!==null&&remaining<=0),factor:timer.fadeMs>0&&remaining!==null?Math.max(0,Math.min(1,remaining/timer.fadeMs)):1};}
  const core = { parseLrc, activeLine, emptyState, validateState, validUri, format,defaultTheme,validateTheme,defaultBindings,validateBindings,binding,serializeLrc,sleepStatus };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  root.LocalEnhancerCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
