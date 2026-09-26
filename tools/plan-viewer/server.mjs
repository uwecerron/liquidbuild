import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PLAN_PORT || 4317);
const sample=process.argv[2] ? path.resolve(process.argv[2]) : null;
if(sample && !fs.statSync(sample).isFile()) throw new Error('PDF not found');
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.bcmap':'application/octet-stream','.ttf':'font/ttf','.wasm':'application/wasm','.pdf':'application/pdf'};
http.createServer((req,res)=>{
 if(req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`){res.writeHead(403).end();return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self' blob:; object-src 'none'; frame-ancestors 'none'");
 if(name==='/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({sample:sample?path.basename(sample):null}));return;}
 let file;
 if(name==='/sample.pdf' && sample) file=sample;
 else if(['/','/index.html','/app.mjs','/style.css'].includes(name)) file=path.join(root,name==='/'?'index.html':name.slice(1));
 else if(name.startsWith('/vendor/')){
  const base=path.join(root,'node_modules/pdfjs-dist');file=path.resolve(base,name.slice(8));
  if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 }else{res.writeHead(404).end();return;}
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',stat.size);
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 });
}).listen(port,'127.0.0.1',()=>console.log(`Local plan viewer: http://127.0.0.1:${port}`));
