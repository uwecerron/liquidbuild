const {chromium}=require('/Users/uwecerron/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true, channel:"chrome"});const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4317')&&!r.url().startsWith('blob:'))remote.push(r.url());});
 await page.goto('http://127.0.0.1:4317');
 await page.waitForFunction(()=>document.querySelector('#sheet').dataset.rendered==='1',{timeout:60000});
 assert.match(await page.locator('#summary').textContent(),/39 sheets/);
 await page.locator('[data-page="11"]').click();await page.waitForFunction(()=>document.querySelector('#sheet').dataset.rendered==='11');
 await page.screenshot({path:'/Users/uwecerron/Desktop/output/plan-viewer-test/ground-floor.png'});
 await page.locator('#measure').click();assert.match(await page.locator('#status').textContent(),/Calibrate/);
 await page.locator('#feet').fill('10');await page.locator('#calibrate').click();
 let box=await page.locator('#overlay').boundingBox();const a={x:box.x+box.width*.3,y:box.y+box.height*.4},b={x:box.x+box.width*.5,y:a.y};
 await page.mouse.click(a.x,a.y);await page.mouse.click(b.x,b.y);
 await page.locator('#measure').click();await page.mouse.click(a.x,a.y);await page.mouse.click(b.x,b.y);
 assert.match(await page.locator('#results').textContent(),/10.00 ft/);
 await page.locator('#in').click();await page.waitForFunction(()=>document.querySelector('#zoom').textContent==='150%');
 assert.match(await page.locator('#results').textContent(),/10.00 ft/);
 await page.locator('#rotate').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('24 × 36'));
 assert.match(await page.locator('#results').textContent(),/10.00 ft/);
 await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#sheet').dataset.rendered==='12');
 assert.equal(await page.locator('#scale').textContent(),'Scale not calibrated');
 await page.locator('#prev').click();await page.waitForFunction(()=>document.querySelector('#sheet').dataset.rendered==='11');assert.match(await page.locator('#scale').textContent(),/calibrated/);
 const dl=page.waitForEvent('download');await page.locator('#export').click();const download=await dl;await download.saveAs('/Users/uwecerron/Desktop/output/plan-viewer-test/test-measurements.json');
 const json=require('/Users/uwecerron/Desktop/output/plan-viewer-test/test-measurements.json');assert.equal(json.pdfSha256.length,64);assert.equal(json.pages['11'].lines.length,1);
 await page.locator('#clear').click();await page.locator('#rotate').click();await page.locator('#rotate').click();await page.locator('#rotate').click();await page.locator('#fit').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('36 × 24'));
 // Render all sheets in the real set, sequentially, to catch problematic fonts/images.
 for(let n=1;n<=39;n++){await page.locator(`[data-page="${n}"]`).click();await page.waitForFunction(n=>document.querySelector('#sheet').dataset.rendered===String(n)&&document.querySelector('#status').textContent.includes('ready'),n,{timeout:60000});}
 await page.locator('[data-page="11"]').click();await page.waitForFunction(()=>document.querySelector('#sheet').dataset.rendered==='11');
 await page.screenshot({path:'/Users/uwecerron/Desktop/output/plan-viewer-test/ground-floor.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(700);await page.screenshot({path:'/Users/uwecerron/Desktop/output/plan-viewer-test/mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,pagesRendered:39,measurement:'synthetic 10 ft reference round-trip, not a field measurement',checks:['sheet navigation','calibration required','measurement arithmetic','zoom persistence','rotation persistence','sheet isolation','JSON export','all 39 sheets','mobile width','no external requests','no browser errors']}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
