const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const loader = ['src/core.js','src/backgrounds.js','src/native-integration.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n').replace('/* MYIFY_FEATURES */',fs.readFileSync(path.join(root,'src/features.js'),'utf8')).replace('/* MYIFY_THEME_EDITOR */',fs.readFileSync(path.join(root,'src/theme-editor.js'),'utf8'));
new (require('node:vm').Script)(loader,{filename:'native-loader.js'});
fs.writeFileSync(path.join(root,'dist/native-loader.js'),loader);
console.log('Built dist/native-loader.js');
