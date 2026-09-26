export const SOURCE_HASH='9d356823109c00f3df6588d96e4659766a99f39517e9bc4aaa27acc277364b0b';
export const PX_PER_FT=(1059-319)/36.5;
export const traceToFeet=([x,y])=>[(x-319)/PX_PER_FT,(y-466)/PX_PER_FT];
export const feetToTrace=([x,z])=>[x*PX_PER_FT+319,z*PX_PER_FT+466];
export const traceToPage=([x,y])=>[80+x*1820/2048,650+y*900/1013];
const wall=(id,label,a,b,openings=[])=>({id,label,a:traceToFeet(a),b:traceToFeet(b),openings,provenance:'manually_traced',edited:false});
const op=(id,type,at,width,sill=0,top=7)=>({id,type,at,width,sill,top,provenance:'approximate_from_plan'});
export function seedModel(){return {
 version:1,sourceHash:SOURCE_HASH,sourcePage:11,unit:'feet',title:'311 · Ground floor',revision:0,
 calibration:{printedDimensionFt:36.5,tracePoints:[[319,949],[1059,949]],note:'36 ft 6 in printed dimension transcribed from A-1.1; manual trace endpoints need confirmation.'},
 assumptions:{wallHeight:9,wallThickness:.5,slabThickness:.5,openingHeights:'Door/window heads 7 ft; window sills 3 ft. Assumed, not verified from schedules.',scope:'One lower ground-floor unit only. No second floor, roof, structure or systems. Porch boundary simplified; stairs omitted.'},
 walls:[
 wall('party','Shared wall',[319,466],[1755,466]),
 wall('west','Porch / living wall',[319,466],[319,860],[op('D-living','door',10,12)]),
 wall('south-living','Living / kitchen exterior',[319,860],[1068,860],[op('W-living','window',14.8,9,3),op('W-kitchen','window',30,4,3)]),
 wall('den-west','Den west',[1068,675],[1068,891]),
 wall('den-front','Den / dining',[1068,675],[1338,675],[op('D-den','door',10,5)]),
 wall('den-south','Den exterior',[1068,891],[1338,891],[op('W-den','window',6.7,7,3)]),
 wall('den-east','Den / garage',[1338,608],[1338,891]),
 wall('garage-south','Garage exterior',[1338,860],[1755,860]),
 wall('garage-east','Garage front',[1755,608],[1755,860],[op('D-garage','garage',6.1,9,0,7)]),
 wall('garage-north','Garage / foyer',[1338,608],[1755,608],[op('D-foyer-garage','door',2.5,3)]),
 wall('entry','Foyer entrance',[1548,466],[1548,608],[op('D-entry','door',3.5,5)]),
 wall('bath-east','Bath / foyer',[1253,466],[1253,600]),
 wall('bath-bottom','Bath / dining',[1129,600],[1253,600],[op('D-bath','door',1.2,2.3)]),
 wall('bath-west','Bath / pantry',[1129,466],[1129,600]),
 wall('pantry-west','Pantry west',[1068,542],[1068,600]),
 wall('pantry-bottom','Pantry door',[1068,600],[1129,600],[op('D-pantry','door',1.5,2)]),
 wall('pantry-top','Pantry top',[1068,542],[1129,542])
 ],
 rooms:[
 {label:'LIVING / DINING',rect:[319,466,737,860],color:'#cfb68e'},
 {label:'KITCHEN',rect:[737,675,1068,860],color:'#e0cbae'},
 {label:'DEN / OFFICE',rect:[1068,675,1338,891],color:'#aac4b3'},
 {label:'GARAGE',rect:[1338,608,1755,860],color:'#b5bec4'},
 {label:'FOYER',rect:[1253,466,1548,608],color:'#d5cbb6'},
 {label:'BATH',rect:[1129,466,1253,600],color:'#b4cbd0'},
 {label:'PORCH',rect:[155,466,319,860],color:'#c7c2b3'}
 ]};}
export function validateModel(m){
 if(!m||m.version!==1||m.sourceHash!==SOURCE_HASH||m.sourcePage!==11||m.unit!=='feet')throw Error('Model does not match this source and schema.');
 const h=m.assumptions?.wallHeight,t=m.assumptions?.wallThickness;
 if(!Number.isFinite(h)||h<7||h>14||!Number.isFinite(t)||t<.2||t>1.2)throw Error('Wall height must be 7–14 ft; thickness 0.2–1.2 ft.');
 if(!Array.isArray(m.walls)||m.walls.length!==17)throw Error('Unexpected wall set.');
 const ids=new Set();
 for(const w of m.walls){
 if(typeof w.id!=='string'||ids.has(w.id)||typeof w.label!=='string')throw Error('Invalid wall identity.');ids.add(w.id);
 if(![w.a,w.b].every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<150)))throw Error('Invalid wall coordinate.');
 const len=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);if(len<.5||len>100)throw Error('Wall length must be 0.5–100 ft.');
 if(!Array.isArray(w.openings)||w.openings.length>10)throw Error('Invalid openings.');
 let end=0;
 for(const o of [...w.openings].sort((a,b)=>a.at-b.at)){
 if(![o.at,o.width,o.sill,o.top].every(Number.isFinite)||o.width<.5||o.sill<0||o.top<=o.sill||o.top>h||o.at-o.width/2<end||o.at+o.width/2>len)throw Error('Openings must fit the wall, remain separate, and stay below wall height.');
 if(!['window','door','garage'].includes(o.type))throw Error('Invalid opening type.');end=o.at+o.width/2;
 }
 }
 return m;
}
// Solid wall rectangles in local (distance-along-wall, height) coordinates.
export function wallPanels(w,height){
 const length=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);let cursor=0;const panels=[];
 for(const o of [...w.openings].sort((a,b)=>a.at-b.at)){
 const left=o.at-o.width/2,right=o.at+o.width/2;
 if(left>cursor)panels.push({x:cursor,width:left-cursor,y:0,height});
 if(o.sill>0)panels.push({x:left,width:o.width,y:0,height:o.sill});
 if(o.top<height)panels.push({x:left,width:o.width,y:o.top,height:height-o.top});cursor=right;
 }
 if(cursor<length)panels.push({x:cursor,width:length-cursor,y:0,height});return panels;
}
