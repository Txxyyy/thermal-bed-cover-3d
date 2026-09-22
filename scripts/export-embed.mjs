import {build} from 'esbuild';
import fs from 'node:fs';
import crypto from 'node:crypto';
const assets={};
for(const name of ['models/controller.glb',...['albedo','normal','roughness'].map(kind=>`textures/controller-fabric-${kind}.png`)]){
 const mime=name.endsWith('.glb')?'model/gltf-binary':'image/png';assets[name]=`data:${mime};base64,${fs.readFileSync(`public/${name}`).toString('base64')}`;
}
const result=await build({entryPoints:['src/embed.js'],bundle:true,format:'iife',target:'es2020',minify:true,write:false,outfile:'embed.js',define:{'import.meta.env.BASE_URL':'"/"','import.meta.hot':'undefined','__INLINE_ASSETS__':JSON.stringify(assets)}});
const js=result.outputFiles.find(file=>file.path.endsWith('.js')).text.replace(/<\/script/gi,'<\\/script');
const css=result.outputFiles.find(file=>file.path.endsWith('.css')).text;
const html=fs.readFileSync('embed.html','utf8').replace('</head>',`<style>${css}</style></head>`).replace('<script type="module" src="/src/embed.js"></script>',()=>`<script>${js}</script>`);
const destination='output/embed';fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(`${destination}/thermal3d.html`,html);
const manifest={protocolVersion:1,file:'thermal3d.html',bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),requirements:['WebGL2'],externalRequests:0};
fs.writeFileSync(`${destination}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
fs.mkdirSync('integrations/flutter/assets',{recursive:true});
fs.copyFileSync(`${destination}/thermal3d.html`,'integrations/flutter/assets/thermal3d.html');
fs.copyFileSync(`${destination}/manifest.json`,'integrations/flutter/assets/manifest.json');
console.log(JSON.stringify(manifest,null,2));
