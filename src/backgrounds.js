/* Local IndexedDB image storage. GIF bytes are retained to preserve animation. */
(function(root){
  'use strict';
  const Core=typeof module!=='undefined'&&module.exports?require('./core.js'):root.LocalEnhancerCore;
  const PREFIX='myify-image:',MAX_GIF=8*1024*1024,MAX_INPUT=32*1024*1024;
  const urls=new Map(),pending=new Map(),listeners=new Set(),fontFaces=new Map(),fontPending=new Map(),issues=new Map();let database;
  function mimeFromBytes(bytes){
    if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
    if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
    const text=String.fromCharCode(...bytes.slice(0,12));
    if(text.startsWith('GIF87a')||text.startsWith('GIF89a'))return 'image/gif';
    if(text.startsWith('RIFF')&&text.slice(8,12)==='WEBP')return 'image/webp';
    throw Error('This is not a supported PNG, JPG, GIF or WebP image.');
  }
  function fontMimeFromBytes(bytes){
    const text=String.fromCharCode(...bytes.slice(0,4));
    if(text==='wOF2')return 'font/woff2';if(text==='wOFF')return 'font/woff';if(text==='OTTO')return 'font/otf';
    if(text==='true'||(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0))return 'font/ttf';
    throw Error('Choose a valid TTF, OTF, WOFF or WOFF2 font.');
  }
  function open(){
    if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open('MyifyBackgrounds',1);request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Could not open local image storage.'));});
    return database;
  }
  async function read(id){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Could not read the saved background.'));});}
  async function digest(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function decode(blob){const url=URL.createObjectURL(blob),image=new Image();try{image.src=url;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw Error('Empty image.');return image;}catch{throw Error('That image could not be decoded. Choose another file.');}finally{URL.revokeObjectURL(url);}}
  async function store(blob,name='Background',preserve=false){
    if(!blob.size||blob.size>MAX_INPUT)throw Error('Choose an image under 32 MB, or an animated GIF under 8 MB.');
    const mime=mimeFromBytes(new Uint8Array(await blob.slice(0,12).arrayBuffer()));
    if(mime==='image/gif'&&blob.size>MAX_GIF)throw Error('Animated GIFs must be under 8 MB.');
    blob=new Blob([blob],{type:mime});const image=await decode(blob);
    if(!preserve&&mime!=='image/gif'&&(blob.size>1024*1024||Math.max(image.naturalWidth,image.naturalHeight)>2560)){
      const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(!blob)throw Error('Could not prepare this background.');
    }
    if(blob.size>MAX_GIF)throw Error('The prepared image is too large. Choose a smaller image.');
    const id=await digest(blob),db=await open();
    await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put({id,blob,kind:'image',name:String(name).slice(0,260)});tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Image storage is full. Remove unused browser data or choose a smaller image.'));tx.onabort=()=>reject(Error('Could not save the background.'));});
    if(!urls.has(id))urls.set(id,URL.createObjectURL(blob));return PREFIX+id;
  }
  function getUrl(value){
    if(!value?.startsWith(PREFIX))return value||'';
    const id=value.slice(PREFIX.length);if(urls.has(id))return urls.get(id);
    if(!pending.has(id))pending.set(id,read(id).then(record=>{if(record)urls.set(id,URL.createObjectURL(record.blob));else issues.set(value,'This saved background is missing. Choose it again or restore a full backup.');listeners.forEach(fn=>fn());}).catch(()=>{}));
    return '';
  }
  async function storeFont(file,name='Custom font'){
    if(!file.size||file.size>16*1024*1024)throw Error('Custom fonts must be under 16 MB.');
    const mime=fontMimeFromBytes(new Uint8Array(await file.slice(0,4).arrayBuffer())),blob=new Blob([file],{type:mime});
    const id=await digest(blob),family='MyifyFont_'+id,face=new FontFace(family,await blob.arrayBuffer());
    try{await face.load();}catch{throw Error('The font could not be loaded. Choose another TTF, OTF, WOFF or WOFF2 file.');}
    const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put({id,blob,kind:'font',name:String(name).slice(0,100)});tx.oncomplete=resolve;tx.onerror=()=>reject(Error('Could not save the custom font.'));tx.onabort=()=>reject(Error('Could not save the custom font.'));});
    document.fonts.add(face);fontFaces.set(id,family);return 'myify-font:'+id;
  }
  function fontFamily(value){
    if(!value?.startsWith('myify-font:'))return value==='System'?'inherit':value;
    const id=value.slice(11);if(fontFaces.has(id))return fontFaces.get(id);
    if(!fontPending.has(id))fontPending.set(id,read(id).then(async record=>{if(!record)throw Error('This custom font is missing. Upload it again or restore a full backup.');const family='MyifyFont_'+id,face=new FontFace(family,await record.blob.arrayBuffer());await face.load();document.fonts.add(face);fontFaces.set(id,family);listeners.forEach(fn=>fn());}).catch(error=>{issues.set(value,error.message);listeners.forEach(fn=>fn());}));
    return 'Segoe UI';
  }
  async function listFonts(){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').getAll();request.onsuccess=()=>resolve(request.result.filter(r=>r.kind==='font').map(r=>({id:'myify-font:'+r.id,name:r.name})));request.onerror=()=>reject(Error('Could not list fonts.'));});}
  async function asDataUrl(value){
    if(!value?.startsWith(PREFIX)&&!value?.startsWith('myify-font:'))return value||'';
    const record=await read(value.slice(value.indexOf(':')+1));if(!record)throw Error('A theme image or font is missing. Upload it again before exporting.');
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not export the background.'));reader.readAsDataURL(record.blob);});
  }
  async function portableTheme(theme){return {...theme,backgroundImage:await asDataUrl(theme.backgroundImage),...(theme.fontFamily.startsWith('myify-font:')?{fontFile:await asDataUrl(theme.fontFamily)}:{})};}
  async function importTheme(value){
    const theme=Core.validateTheme(value);
    if(theme.backgroundImage.startsWith('data:'))theme.backgroundImage=await store(await(await fetch(theme.backgroundImage)).blob(),theme.name,true);
    else if(theme.backgroundImage.startsWith(PREFIX)&&!await read(theme.backgroundImage.slice(PREFIX.length)))throw Error('The theme refers to an unavailable local image. Import a theme exported with its image included.');
    if(theme.fontFamily.startsWith('myify-font:')){
      if(value.fontFile){if(typeof value.fontFile!=='string'||value.fontFile.length>24*1024*1024||!/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/.test(value.fontFile))throw Error('Invalid embedded font.');const id=await storeFont(await(await fetch(value.fontFile)).blob(),theme.fontName);if(id!==theme.fontFamily)throw Error('Font checksum mismatch.');}
      else if(!await read(theme.fontFamily.slice(11)))throw Error('The custom font is missing from this theme export.');
    }
    return theme;
  }
  async function exportAssets(state){
    const ids=[...new Set([state.settings.customTheme,...state.settings.savedThemes].flatMap(t=>[t.backgroundImage,t.fontFamily]).filter(v=>v?.startsWith(PREFIX)||v?.startsWith('myify-font:')))];
    const result=[];let size=0;
    for(const id of ids){const data=await asDataUrl(id);size+=data.length;if(size>110*1024*1024)throw Error('Theme assets exceed the backup limit. Export individual themes instead.');const record=await read(id.slice(id.indexOf(':')+1));result.push({id,data,name:record?.name||''});}return result;
  }
  async function importAssets(assets=[]){
    if(!Array.isArray(assets)||assets.length>62)throw Error('Invalid theme asset backup.');
    for(const asset of assets){
      if(asset.id?.startsWith('myify-font:')){if(typeof asset.data!=='string'||asset.data.length>24*1024*1024||!/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/=]+$/.test(asset.data))throw Error('Invalid font backup.');const id=await storeFont(await(await fetch(asset.data)).blob(),asset.name||'Restored font');if(id!==asset.id)throw Error('Font checksum mismatch.');}
      else{const theme=Core.validateTheme({backgroundImage:asset.data});if(!theme.backgroundImage.startsWith('data:'))throw Error('Invalid background backup.');const blob=await(await fetch(theme.backgroundImage)).blob();const id=PREFIX+await digest(blob);if(id!==asset.id)throw Error('Background checksum mismatch.');await store(blob,'Restored background',true);}
    }
  }
  const api={mimeFromBytes,fontMimeFromBytes,store,storeFont,fontFamily,listFonts,getUrl,portableTheme,importTheme,exportAssets,importAssets,error(value){return issues.get(value)||'';},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MyifyBackgrounds=api;
})(typeof window!=='undefined'?window:globalThis);
