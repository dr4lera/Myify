/* Inlined into the renderer adapter. Theme files keep the existing v1 format. */
  function mountThemeEditor(container) {
    container.classList.add('le-theme-editor');
    const note=el('p','Colors, fonts and backgrounds update live. Save a named theme to keep the complete look.','le-subtle');
    const top=el('div',undefined,'le-theme-top');
    const mode=el('select',undefined,'le-input');mode.id='enhancer-theme-mode';mode.setAttribute('aria-label','Theme preset');
    for(const [value,label]of [['forest','Spotify default'],['midnight','Midnight blue'],['plum','Plum'],['custom','Custom theme']]){const option=el('option',label);option.value=value;mode.append(option);}
    const name=el('input',undefined,'le-input');name.id='enhancer-theme-name';name.maxLength=60;name.placeholder='Name your theme';name.setAttribute('aria-label','Theme name');
    top.append(mode,name);
    const layout=el('div',undefined,'le-theme-layout'),controls=el('div'),preview=el('div',undefined,'le-theme-preview');
    const colorGrid=el('div',undefined,'le-theme-colors'),colorControls={};
    function update(patch){
      const customTheme=Core.validateTheme({...palette(),...patch});
      if(save({...state,settings:{...state.settings,theme:'custom',customTheme}})){appearance();refresh();}
    }
    controls.append(el('h3','Colors'),colorGrid);
    for(const [key,label]of [['background','Main background'],['panel','Panels & player bar'],['text','Text'],['muted','Secondary text'],['accent','Accent & buttons'],['lyricsBackground','Lyric background'],['lyricsText','Lyric text']]){
      const group=el('div',undefined,'le-theme-color'),labelEl=el('label',label),pair=el('div',undefined,'le-row');
      const picker=el('input');picker.type='color';picker.id='enhancer-color-'+key;picker.setAttribute('aria-label',label+' color');labelEl.htmlFor=picker.id;
      const hex=el('input',undefined,'le-input');hex.maxLength=7;hex.spellcheck=false;hex.setAttribute('aria-label',label+' hex value');hex.placeholder='#RRGGBB';
      picker.oninput=()=>update({[key]:picker.value});
      hex.onchange=()=>{if(!/^#[0-9a-f]{6}$/i.test(hex.value)){say('Use a color such as #a85ac1.');hex.value=palette()[key];return;}update({[key]:hex.value});};
      pair.append(picker,hex);group.append(labelEl,pair);colorGrid.append(group);colorControls[key]={picker,hex};
    }
    controls.append(el('h3','Typography'));
    const font=el('select',undefined,'le-input');font.id='enhancer-theme-font';font.setAttribute('aria-label','App font');
    for(const value of ['System','Segoe UI','Arial','Georgia','Consolas']){const option=el('option',value==='System'?'Spotify default font':value);option.value=value;font.append(option);}
    font.onchange=()=>update({fontFamily:font.value});row(controls,'App font',font);
    const size=el('input');size.type='range';size.min='18';size.max='48';size.id='enhancer-lyric-size';size.setAttribute('aria-label','Lyric text size');
    const sizeLabel=el('span');size.oninput=()=>{if(save({...state,settings:{...state.settings,fontSize:Number(size.value)}})){appearance();refresh();}};
    const sizeRow=el('div',undefined,'le-row');sizeRow.append(size,sizeLabel);row(controls,'Lyric text size',sizeRow);
    controls.append(el('h3','Background image'));
    const imageInput=el('input');imageInput.type='file';imageInput.accept='image/png,image/jpeg,image/webp';imageInput.hidden=true;imageInput.id='enhancer-background-file';
    const imageStatus=el('p',undefined,'le-subtle');imageStatus.id='enhancer-background-status';
    imageInput.onchange=()=>{
      const file=imageInput.files[0];imageInput.value='';if(!file)return;
      if(file.size>1000000||!['image/png','image/jpeg','image/webp'].includes(file.type))return say('Choose a PNG, JPEG or WebP image under 1 MB.');
      const reader=new FileReader();reader.onload=()=>{try{update({backgroundImage:reader.result});say('Background image applied. Save theme to keep it as a preset.');}catch(e){say(e.message);}};reader.onerror=()=>say('Could not read that image.');reader.readAsDataURL(file);
    };
    const removeImage=button('Remove image',()=>update({backgroundImage:''})),imageButtons=el('div',undefined,'le-row');
    imageButtons.append(button('Choose image',()=>imageInput.click()),removeImage,imageInput);controls.append(imageButtons,imageStatus);
    const previewTitle=el('div','Live preview','le-theme-preview-caption'),sample=el('div',undefined,'le-theme-sample');
    const sampleHeader=el('div',undefined,'le-theme-sample-header'),sampleName=el('strong','Your song'),sampleArtist=el('p','Local music');
    const sampleButton=button('Play',()=>{});sampleButton.tabIndex=-1;sampleButton.setAttribute('aria-hidden','true');
    sampleHeader.append(sampleName,sampleArtist,sampleButton);
    const lyricBox=el('div',undefined,'le-theme-sample-lyrics'),mutedLine=el('p','A line before the current lyric'),active=el('p','Your synchronized lyrics'),nextLine=el('p','The next line appears here');
    lyricBox.append(mutedLine,active,nextLine);sample.append(sampleHeader,lyricBox);preview.append(previewTitle,sample,el('p','Preview uses the same colors, font and background as your applied theme.','le-subtle'));
    layout.append(controls,preview);
    const saved=el('select',undefined,'le-input');saved.id='enhancer-saved-themes';saved.setAttribute('aria-label','Saved themes');
    saved.onchange=()=>{if(saved.value==='')return;const customTheme=Core.validateTheme(state.settings.savedThemes[Number(saved.value)]);if(save({...state,settings:{...state.settings,theme:'custom',customTheme}})){appearance();refresh();say('Saved theme loaded.');}};
    const themeFile=el('input');themeFile.type='file';themeFile.accept='.json';themeFile.id='enhancer-theme-file';themeFile.hidden=true;
    themeFile.onchange=async()=>{const file=themeFile.files[0];themeFile.value='';if(!file)return;try{
      if(file.size>2*1024*1024)throw Error('Theme files must be under 2 MB.');
      const data=JSON.parse(await file.text());if(data.type!=='spotify-native-enhancer-theme'||data.version!==1)throw Error('Choose a Myify theme JSON file.');
      const customTheme=Core.validateTheme(data.theme),savedThemes=[...state.settings.savedThemes.filter(t=>t.name!==customTheme.name),customTheme].slice(-30);
      if(save({...state,settings:{...state.settings,theme:'custom',customTheme,savedThemes}})){appearance();refresh();say('Complete theme imported, including font and background.');}
    }catch(e){say(e.message);}};
    const buttons=el('div',undefined,'le-row le-theme-buttons');
    buttons.append(button('Save theme',()=>{
      const customTheme=Core.validateTheme({...palette(),name:name.value.trim()||'My theme'}),savedThemes=[...state.settings.savedThemes.filter(t=>t.name!==customTheme.name),customTheme].slice(-30);
      if(save({...state,settings:{...state.settings,theme:'custom',customTheme,savedThemes}})){appearance();refresh();say('Theme saved with colors, font and background.');}
    },true),button('Export theme',()=>download('myify-theme.json',JSON.stringify({type:'spotify-native-enhancer-theme',version:1,theme:Core.validateTheme({...palette(),name:name.value.trim()||palette().name})},null,2))),button('Import theme',()=>themeFile.click()),themeFile);
    const savedRow=el('div',undefined,'le-theme-saved');savedRow.append(el('label','Saved themes'),saved);
    container.append(note,top,layout,buttons,savedRow);
    mode.onchange=()=>{if(save({...state,settings:{...state.settings,theme:mode.value}})){appearance();refresh();}};
    name.onchange=()=>update({name:name.value.trim()||'My theme'});
    function refresh(){
      const theme=palette(),focused=document.activeElement;
      mode.value=state.settings.theme;if(focused!==name)name.value=theme.name;
      for(const [key,{picker,hex}]of Object.entries(colorControls)){picker.value=theme[key];if(focused!==hex)hex.value=theme[key];}
      font.value=theme.fontFamily||'System';size.value=state.settings.fontSize;sizeLabel.textContent=state.settings.fontSize+' px';
      imageStatus.textContent=theme.backgroundImage?'Image attached · included in saved themes and exports':'No image · PNG, JPEG or WebP under 1 MB';removeImage.disabled=!theme.backgroundImage;
      const previous=saved.value;saved.replaceChildren();const placeholder=el('option','Choose a saved theme');placeholder.value='';saved.append(placeholder);
      state.settings.savedThemes.forEach((theme,index)=>{const option=el('option',theme.name);option.value=String(index);saved.append(option);});if([...saved.options].some(option=>option.value===previous))saved.value=previous;
      sample.style.backgroundColor=theme.background;sample.style.color=theme.text;sample.style.fontFamily=theme.fontFamily==='System'?'inherit':theme.fontFamily;
      sample.style.backgroundImage=theme.backgroundImage?`linear-gradient(#0005,#0005),url("${theme.backgroundImage}")`:'none';
      sampleHeader.style.backgroundColor=theme.panel;sampleArtist.style.color=theme.muted;sampleButton.style.backgroundColor=theme.accent;sampleButton.style.color='#101010';
      lyricBox.style.backgroundColor=theme.lyricsBackground;active.style.color=theme.lyricsText;active.style.fontSize=Math.min(32,state.settings.fontSize)+'px';mutedLine.style.color=theme.lyricsText;mutedLine.style.opacity='.5';nextLine.style.color=theme.lyricsText;nextLine.style.opacity='.5';
    }
    const unsubscribe=subscribe(()=>{if(!container.isConnected){unsubscribe();return;}refresh();});
    container._disposeTheme=unsubscribe;refresh();
  }
  style.textContent+=`
    .le-theme-editor{padding:24px;border:1px solid #ffffff26;border-radius:12px;background:var(--background-elevated-base,#181818)}
    .le-theme-editor h3{font-size:15px;font-weight:700;margin:24px 0 12px}.le-theme-editor h3:first-child{margin-top:0}
    .le-theme-top{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0 24px}.le-theme-top input{flex:1;min-width:160px}
    .le-theme-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:28px;align-items:start}
    .le-theme-colors{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}
    .le-theme-color label{display:block;font-size:13px;margin-bottom:7px}.le-theme-color input[type=color]{width:40px;height:36px;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}.le-theme-color .le-input{width:96px;font-family:Consolas,monospace;font-size:13px}
    .le-theme-preview{position:sticky;top:24px}.le-theme-preview-caption{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;color:var(--text-subdued,#b3b3b3)}
    .le-theme-sample{border:1px solid #ffffff30;border-radius:12px;padding:14px;background-size:cover;background-position:center;overflow:hidden}.le-theme-sample-header{border-radius:8px;padding:18px;margin-bottom:14px}.le-theme-sample-header strong{font-size:20px}.le-theme-sample-header p{margin:5px 0 14px}.le-theme-sample-header button{border:0;border-radius:999px;padding:8px 20px;font-weight:700;pointer-events:none}.le-theme-sample-lyrics{border-radius:8px;padding:22px 16px}.le-theme-sample-lyrics p{font-weight:700;line-height:1.3;margin:12px 0}
    .le-theme-buttons{margin:24px 0 18px}.le-theme-saved{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.le-theme-saved select{flex:1;min-width:190px}.le-theme-editor button:disabled{opacity:.4;cursor:default}.le-theme-editor input[type=range]{max-width:150px}
    @media(max-width:1050px){.le-theme-layout{grid-template-columns:1fr}.le-theme-preview{position:static}.le-theme-sample-lyrics{padding:14px}.le-theme-colors{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
  `;
