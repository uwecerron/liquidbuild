import * as pdfjs from '/vendor/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/build/pdf.worker.mjs';
const $=id=>document.getElementById(id);
let doc,pageNo=1,rotation=0,zoom=1,viewport,renderTask,mode=null,start=null,hash='',fileName='',generation=0,loading=false;
const states=new Map();
const state=()=>{if(!states.has(pageNo))states.set(pageNo,{feetPerPoint:null,calibration:null,lines:[]});return states.get(pageNo);};
const status=t=>$('status').textContent=t;
function tool(value){mode=value;start=null;$('overlay').classList.toggle('idle',!mode);for(const id of ['calibrate','measure'])$(id).classList.toggle('selected',mode===id);}
function draw(){
 const svg=$('overlay');svg.replaceChildren();if(!viewport)return;
 svg.setAttribute('viewBox',`0 0 ${viewport.width} ${viewport.height}`);
 const s=state();
 for(const l of [...(s.calibration?[{...s.calibration,cal:true}]:[]),...s.lines]){
  const a=viewport.convertToViewportPoint(...l.a),b=viewport.convertToViewportPoint(...l.b);
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  for(const [k,v]of Object.entries({x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:l.cal?'#cf7134':'#14745b','stroke-width':2}))line.setAttribute(k,v);svg.append(line);
  for(const p of [a,b]){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);c.setAttribute('r',4);c.setAttribute('fill',l.cal?'#cf7134':'#14745b');svg.append(c);}
  const t=document.createElementNS(svg.namespaceURI,'text');t.setAttribute('x',(a[0]+b[0])/2);t.setAttribute('y',(a[1]+b[1])/2-9);t.setAttribute('font-size',14);t.setAttribute('fill','#0c543f');t.setAttribute('stroke','white');t.setAttribute('stroke-width',3);t.setAttribute('paint-order','stroke');t.textContent=`${l.feet.toFixed(2)} ft${l.cal?' · calibration':''}`;svg.append(t);
 }
 $('results').replaceChildren();s.lines.forEach((l,i)=>{const div=document.createElement('div');div.className='reading';const strong=document.createElement('strong');strong.textContent=`${l.feet.toFixed(2)} ft`;const small=document.createElement('small');small.textContent=`Measurement ${i+1} · sheet ${pageNo}`;div.append(strong,small);$('results').append(div);});
 $('scale').textContent=s.feetPerPoint?`Sheet ${pageNo} calibrated · ${s.calibration.feet} ft reference`:'Scale not calibrated';
}
async function render(){
 if(!doc)return;const token=++generation;tool(null);$('overlay').classList.add('idle');
 if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}}
 status(`Rendering sheet ${pageNo}…`);
 try{
 const p=await doc.getPage(pageNo);if(token!==generation)return;
 const base=p.getViewport({scale:1,rotation:(p.rotate+rotation)%360});
 const fit=Math.max(.08,Math.min(($('stage').clientWidth-48)/base.width,($('stage').clientHeight-48)/base.height));
 viewport=p.getViewport({scale:fit*zoom,rotation:(p.rotate+rotation)%360});
 const c=$('canvas');const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16_000_000/(viewport.width*viewport.height)));
 c.width=Math.floor(viewport.width*ratio);c.height=Math.floor(viewport.height*ratio);c.style.width=viewport.width+'px';c.style.height=viewport.height+'px';
 $('sheet').style.width=viewport.width+'px';$('sheet').style.height=viewport.height+'px';
 renderTask=p.render({canvasContext:c.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});await renderTask.promise;if(token!==generation)return;
 $('position').textContent=`${pageNo} / ${doc.numPages}`;$('zoom').textContent=`${Math.round(zoom*100)}%`;
 $('prev').disabled=pageNo===1;$('next').disabled=pageNo===doc.numPages;
 for(const b of $('pages').children)b.classList.toggle('active',Number(b.dataset.page)===pageNo);
 draw();status(`Sheet ${pageNo} ready · ${(base.width/72).toFixed(0)} × ${(base.height/72).toFixed(0)} in · original drawing`);
 $('sheet').dataset.rendered=String(pageNo);
 }catch(e){if(e.name!=='RenderingCancelledException')status('Could not render: '+e.message);}
}
async function open(bytes,name){
 if(loading)return;loading=true;generation++;if(renderTask)renderTask.cancel();status('Opening local PDF…');$('sheet').dataset.rendered='';
 try{
 if(doc){await doc.destroy();doc=null;}states.clear();pageNo=1;rotation=0;zoom=1;fileName=name;
 hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 doc=await pdfjs.getDocument({data:new Uint8Array(bytes),cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/',isEvalSupported:false}).promise;
 $('filename').textContent=name;$('summary').textContent=`${doc.numPages} sheets · local PDF`;$('pages').replaceChildren();
 for(let n=1;n<=doc.numPages;n++){const b=document.createElement('button');b.dataset.page=n;b.textContent=`Sheet ${String(n).padStart(2,'0')}`;b.onclick=()=>{pageNo=n;zoom=1;render();};$('pages').append(b);}
 const requested=Number(new URLSearchParams(location.search).get('page'));if(Number.isInteger(requested)&&requested>=1&&requested<=doc.numPages)pageNo=requested;
 await render();
 }catch(e){status('Unable to open PDF: '+e.message);}finally{loading=false;}
}
$('file').onchange=async e=>{const f=e.target.files[0];if(f)await open(await f.arrayBuffer(),f.name);};
$('prev').onclick=()=>{if(doc&&pageNo>1){pageNo--;render();}};$('next').onclick=()=>{if(doc&&pageNo<doc.numPages){pageNo++;render();}};
$('in').onclick=()=>{zoom=Math.min(zoom*1.5,8);render();};$('out').onclick=()=>{zoom=Math.max(zoom/1.5,.5);render();};$('fit').onclick=()=>{zoom=1;render();};$('rotate').onclick=()=>{rotation=(rotation+90)%360;render();};
$('cancel').onclick=()=>{tool(null);status('Tool cancelled.');};
$('calibrate').onclick=()=>{if(!doc)return;const feet=Number($('feet').value);if(!Number.isFinite(feet)||feet<=0){status('Enter a positive known distance in feet.');return;}tool('calibrate');status('Click both ends of a known dimension. Recalibration clears prior measurements on this sheet.');};
$('measure').onclick=()=>{if(!doc)return;if(!state().feetPerPoint){status('Calibrate this sheet first.');return;}tool('measure');status('Click two points to measure their distance.');};
$('overlay').onclick=e=>{
 if(!mode||!viewport)return;const r=$('overlay').getBoundingClientRect();const p=viewport.convertToPdfPoint((e.clientX-r.left)*viewport.width/r.width,(e.clientY-r.top)*viewport.height/r.height);
 if(!start){start=p;status('First point set. Click the second point.');return;}
 const a=start,b=p,d=Math.hypot(a[0]-b[0],a[1]-b[1]);start=null;if(d<.01){status('Choose two distinct points.');return;}
 if(mode==='calibrate'){const feet=Number($('feet').value);if(!Number.isFinite(feet)||feet<=0){tool(null);status('Invalid reference distance.');return;}state().feetPerPoint=feet/d;state().calibration={a,b,feet};state().lines=[];tool(null);status('Calibration saved for this sheet. Select Measure.');}
 else{state().lines.push({a,b,feet:d*state().feetPerPoint});status('Measurement added. Click another pair, or Cancel tool.');}draw();
};
$('clear').onclick=()=>{states.delete(pageNo);tool(null);draw();status('Calibration and measurements cleared for this sheet.');};
$('export').onclick=()=>{if(!doc)return;const data={version:1,pdfName:fileName,pdfSha256:hash,coordinateSystem:'PDF page points',unit:'feet',pages:Object.fromEntries(states),note:'User-calibrated reference measurements, not verified field dimensions'};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='plan-measurements.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
let resize;window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(()=>render(),200);});
tool(null);const cfg=await fetch('/config').then(r=>r.json());if(cfg.sample)await open(await fetch('/sample.pdf').then(r=>r.arrayBuffer()),cfg.sample);
