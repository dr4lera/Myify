const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const loader = ['src/core.js','src/native-integration.js'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n');
new (require('node:vm').Script)(loader,{filename:'native-loader.js'});
fs.writeFileSync(path.join(root,'dist/native-loader.js'),loader);
console.log('Built dist/native-loader.js');
