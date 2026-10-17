/* Myify. No remote scripts, analytics, or subscription changes. */
(function (root) {
  'use strict';
  const VERSION = 1, KEY = 'local-enhancer:v1';
  const MAX_FILE = 512 * 1024;
  const validUri = value => typeof value === 'string' && /^spotify:(local|track|episode|chapter|playlist):[^\s]+$/.test(value);
  const defaultTheme = () => ({name:'My theme',background:'#121212',panel:'#181818',text:'#ffffff',muted:'#b3b3b3',accent:'#1ed760',lyricsBackground:'#1e5a3c',lyricsText:'#ffffff'});
  function validateTheme(value) {
    if(!value || typeof value !== 'object') throw Error('Invalid theme.');
    const theme=defaultTheme();theme.name=String(value.name||theme.name).slice(0,60);
    for(const key of ['background','panel','text','muted','accent','lyricsBackground','lyricsText']){
      if(typeof value[key] !== 'undefined' && !/^#[0-9a-f]{6}$/i.test(value[key]))throw Error('Theme colors must use #RRGGBB.');
      if(value[key])theme[key]=value[key].toLowerCase();
    }
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
  function emptyState() { return { version: VERSION, tracks: {}, bookmarks: [], settings: { theme: 'forest', fontSize: 30, customTheme:defaultTheme(),savedThemes:[] } }; }
  function validateState(value) {
    if (!value || value.version !== VERSION || !value.tracks || typeof value.tracks !== 'object' || Array.isArray(value.tracks) || !Array.isArray(value.bookmarks)) throw Error('This is not an Enhancer v1 backup.');
    const state = emptyState();
    for (const [uri, track] of Object.entries(value.tracks)) {
      if (!validUri(uri) || !track || typeof track !== 'object') throw Error('Backup has an invalid song.');
      if (typeof track.raw !== 'undefined' && (typeof track.raw !== 'string' || track.raw.length > MAX_FILE)) throw Error('Invalid lyric data.');
      state.tracks[uri] = { title: String(track.title || 'Untitled').slice(0, 500), artist: String(track.artist || '').slice(0, 500), raw: track.raw || '', file: String(track.file || '').slice(0, 500), offset: Number.isFinite(track.offset) ? Math.max(-600000, Math.min(600000, track.offset)) : 0 };
    }
    for (const b of value.bookmarks.slice(0, 2000)) {
      if (!b || !validUri(b.uri) || !Number.isFinite(b.ms) || b.ms < 0) throw Error('Backup has an invalid bookmark.');
      state.bookmarks.push({ id: String(b.id).slice(0, 100), uri: b.uri, ms: b.ms, title: String(b.title || '').slice(0, 500), note: String(b.note || '').slice(0, 500) });
    }
    const s = value.settings || {};
    state.settings.theme = ['forest', 'midnight', 'plum','custom'].includes(s.theme) ? s.theme : 'forest';
    state.settings.fontSize = Number.isFinite(s.fontSize) ? Math.max(18, Math.min(48, s.fontSize)) : 30;
    state.settings.customTheme=s.customTheme?validateTheme(s.customTheme):defaultTheme();
    state.settings.savedThemes=Array.isArray(s.savedThemes)?s.savedThemes.slice(0,30).map(validateTheme):[];
    return state;
  }
  function format(ms) { const seconds = Math.floor(Math.max(0, ms) / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  const core = { parseLrc, activeLine, emptyState, validateState, validUri, format,defaultTheme,validateTheme };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }
  root.LocalEnhancerCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
