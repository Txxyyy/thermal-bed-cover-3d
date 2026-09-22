import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve('output/mobile'),port=Number(process.env.THERMAL_MOBILE_PORT||5180);
const file=path.join(root,'温控床笠-手机预览.html');
if(!fs.existsSync(file))throw new Error('Run npm run export:mobile before starting the phone preview.');
const server=http.createServer((request,response)=>{
 // Only the exported preview is served; source CAD, references, and project files are never exposed.
 let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Bad URL');return;}
 if(!['/','/index.html','/温控床笠-手机预览.html'].includes(pathname)){response.writeHead(404);response.end('Not found');return;}
 response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).on('error',()=>response.destroy()).pipe(response);
});
server.listen(port,'0.0.0.0',()=>{console.log(`Local: http://127.0.0.1:${port}/`);for(const [name,rows] of Object.entries(os.networkInterfaces())){if(name.startsWith('utun'))continue;for(const row of rows||[])if(row.family==='IPv4'&&!row.internal)console.log(`Phone on same Wi-Fi: http://${row.address}:${port}/`);}});
