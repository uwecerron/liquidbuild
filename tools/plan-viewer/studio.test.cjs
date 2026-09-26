const {chromium}=require('/Users/uwecerron/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
const out='/Users/uwecerron/Desktop/output/plan-studio-test';
(async()=>{
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
const context=await browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});const page=await context.newPage();const errors=[],remote=[],writes=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4317/')&&!r.url().startsWith('blob:'))remote.push(r.url());if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
const ready=()=>page.waitForSelector('#scene[data-ready=true]',{timeout:60000});
await page.goto('http://127.0.0.1:4317/studio.html');await ready();assert.equal(await page.locator('#trace line').count(),17);
await page.screenshot({path:out+'/perspective.png'});
await page.locator('#height').fill('12');await page.locator('#height').dispatchEvent('change');assert.equal(await page.locator('#scene').getAttribute('data-height'),'12');
await page.locator('#wall').selectOption('party');const revision=await page.locator('#scene').getAttribute('data-revision');
await page.locator('#bx').fill('0');await page.locator('#bz').fill('0');await page.locator('#apply-wall').click();assert.match(await page.locator('#message').textContent(),/Wall length/);assert.equal(await page.locator('#scene').getAttribute('data-revision'),revision);
await page.locator('#wall').selectOption('south-living');await page.locator('#opening-width').fill('100');await page.locator('#apply-opening').click();assert.match(await page.locator('#message').textContent(),/Openings must fit/);
await page.locator('#opening-width').fill('8');await page.locator('#apply-opening').click();assert.equal(await page.locator('#opening-width').inputValue(),'8');
await page.locator('#undo').click();assert.equal(await page.locator('#opening-width').inputValue(),'9');
await page.locator('#wall').selectOption('party');await page.locator('#bz').fill('1');await page.locator('#apply-wall').click();assert.match(await page.locator('#wall-state').textContent(),/edited locally/);assert.notEqual(await page.locator('[data-wall=party]').getAttribute('y2'),'466');await page.locator('#undo').click();
await page.locator('#save').click();await page.reload();await ready();assert.equal(await page.locator('#height').inputValue(),'12');
await page.locator('#top').click();await page.locator('#cutaway').click();await page.screenshot({path:out+'/top-cutaway.png'});await page.locator('#orbit').click();
const box=await page.locator('#scene canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.65,{steps:10});await page.mouse.up();
await context.setOffline(true);
await page.locator('#height').fill('10');await page.locator('#height').dispatchEvent('change');assert.equal(await page.locator('#scene').getAttribute('data-height'),'10');
let download=page.waitForEvent('download');await page.locator('#export-glb').click();await(await download).saveAs(out+'/model.glb');const glb=await fs.readFile(out+'/model.glb');assert.equal(glb.toString('utf8',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);const json=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));const root=json.nodes.find(n=>n.extras?.sourcePage===11);assert.equal(root.extras.units,'meters');assert.equal(root.extras.assumptions.wallHeight,10);assert.equal(root.extras.constructionReady,false);assert.ok(json.meshes.length>30);
// Export remains full height even when the display uses cutaway.
assert.ok(json.accessors.some(a=>a.type==='VEC3'&&a.max?.[1]>=1.524-.001));
download=page.waitForEvent('download');await page.locator('#export-json').click();await(await download).saveAs(out+'/model.json');const model=JSON.parse(await fs.readFile(out+'/model.json','utf8'));assert.equal(model.unit,'feet');assert.equal(model.assumptions.wallHeight,10);
await context.setOffline(false);await page.locator('#reset-model').click();await page.locator('#save').click();await page.locator('#cutaway').click();await page.locator('#reset-camera').click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(writes,[]);
console.log(JSON.stringify({passed:true,walls:17,glbBytes:glb.length,glbMeshes:json.meshes.length,offlineEditAndExport:true,invalidEditsRejected:true,saveReload:true,mobileNoOverflow:true,externalRequests:remote.length,serverWrites:writes.length,pageErrors:errors.length}));
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
