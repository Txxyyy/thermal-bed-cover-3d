import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const assets={};
for(const name of ['models/controller.glb',...['albedo','normal','roughness'].map(kind=>`textures/controller-fabric-${kind}.png`)]){
 const mime=name.endsWith('.glb')?'model/gltf-binary':'image/png';assets[name]=`data:${mime};base64,${fs.readFileSync(path.join('public',name)).toString('base64')}`;
}
const result=await build({entryPoints:['src/mobile.js'],bundle:true,format:'esm',target:'es2022',minify:true,write:false,outfile:'mobile.js',define:{'import.meta.env.BASE_URL':'"/"','import.meta.hot':'undefined','__INLINE_ASSETS__':JSON.stringify(assets)},legalComments:'inline'});
const js=result.outputFiles.find(file=>file.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script');
const css=result.outputFiles.find(file=>file.path.endsWith('.css')).text;
const template=fs.readFileSync('mobile.html','utf8');
const html=template.replace('</head>',`<style>${css}</style></head>`).replace('<script type="module" src="/src/mobile.js"></script>',()=>`<script type="module">${js}</script>`);
fs.mkdirSync('output/mobile',{recursive:true});fs.writeFileSync('output/mobile/温控床笠-手机预览.html',html);
console.log(`Standalone HTML: ${Buffer.byteLength(html)} bytes; embedded Three.js + CAD + all material maps.`);
