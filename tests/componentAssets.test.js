const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const config = JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'));
const excluded = relative => config.packOptions.ignore.some(e => e.type === 'folder' ? relative.startsWith(e.value+'/') : relative === e.value);
const walk = directory => fs.readdirSync(directory,{withFileTypes:true}).flatMap(e => e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(directory,e.name)) : [path.join(directory,e.name)]);
let references = 0;
for (const file of walk(root).filter(f=>f.endsWith('.wxml')&&!f.startsWith(path.join(root, '_archived') + path.sep))) {
 const source = fs.readFileSync(file,'utf8');
 for (const match of source.matchAll(/\/images\/[a-zA-Z0-9/_-]+\.(?:png|svg|webp|gif)/g)) {
  const relative = match[0].slice(1);
  assert(fs.existsSync(path.join(root,relative)), 'Missing '+relative);
  assert(!excluded(relative), 'Runtime asset excluded: '+relative);
  references++;
 }
}
assert.equal(config.appid,'wx19e17d6811ea8c83');
for(const folder of ['design-reference','tests'])assert(excluded(folder+'/sample'));
const size=walk(root).filter(f=>!excluded(path.relative(root,f).split(path.sep).join('/'))).reduce((n,f)=>n+fs.statSync(f).size,0);
assert(size<1800*1024, 'Estimated source package too large: '+size);
console.log('PASS '+references+' image references included; AppID and source-size checks ('+size+' bytes). Actual WeChat upload size still needs device-tool verification.');
