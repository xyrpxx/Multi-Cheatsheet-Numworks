const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../docs'), BASE = '/Multi-Cheatsheet-Numworks/';
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  if (!name.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
  const file = path.resolve(ROOT, name.slice(BASE.length) || 'index.html');
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css'};
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE} : {})});
  try {
    const url = `http://127.0.0.1:${server.address().port}${BASE}`;
    const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1360, height: 900}});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.evaluate(() => editor.ready);
    assert.equal(await page.locator('#saveStatus').innerText(), 'No saved gallery yet');
    const image = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#111'; x.fillRect(0, 0, 64, 128); return c.toDataURL('image/png');
    });
    const upload = async () => {
      await page.locator('#fileInput').setInputFiles(['one', 'two'].map(name => ({name: name+'.png', mimeType:'image/png', buffer:Buffer.from(image.split(',')[1], 'base64')})));
      await page.waitForFunction(() => !editor.importing && editor.items.length === 2);
    };
    await upload();
    await page.locator('#rotateBtn').click();
    assert.equal(await page.evaluate(() => editor.sel().angle), 90);
    await page.locator('#undoBtn').click(); assert.equal(await page.evaluate(() => editor.sel().angle), 0);
    await page.locator('#redoBtn').click(); assert.equal(await page.evaluate(() => editor.sel().angle), 90);
    await page.locator('#flipHBtn').click(); assert.equal(await page.evaluate(() => editor.sel().fx), -1);
    await page.locator('#flipVBtn').click(); assert.equal(await page.evaluate(() => editor.sel().fy), -1);
    await page.locator('#rotateCustomBtn').click();
    assert(await page.locator('#pageSelect').isDisabled());
    await page.locator('#rotateAngle').fill('35'); await page.locator('#rotateAngle').dispatchEvent('input');
    await page.locator('#rotateConfirm').click(); assert.equal(await page.evaluate(() => editor.sel().angle), 35);
    await page.locator('#cropBtn').click();
    await page.evaluate(() => { editor.cropSel = {x:10, y:10, w:60, h:80}; editor.drawCrop(); });
    await page.locator('#cropConfirm').click(); assert.equal(await page.evaluate(() => editor.sel().crop.w), 60);
    const first = await page.evaluate(() => ({items: JSON.stringify(editor.items), history: editor.undoStack.length}));
    await page.locator('#addPageBtn').click();
    assert.equal(await page.evaluate(() => editor.undoStack.length), 0);
    await page.locator('#downloadBtn').click(); assert.match(await page.locator('#statusText').innerText(), /Page 2 is empty/);
    await upload(); await page.locator('#rotateBtn').click();
    await page.locator('#pageSelect').selectOption('0');
    assert.deepEqual(await page.evaluate(() => ({items:JSON.stringify(editor.items), history:editor.undoStack.length})), first);
    await page.locator('#pageDownBtn').click();
    assert.equal(await page.evaluate(() => editor.pageIndex), 1);
    await page.locator('#colors').fill('4'); await page.locator('#colors').dispatchEvent('input'); await page.locator('#colors').dispatchEvent('change');
    await page.locator('#invert').check();
    await page.locator('#sizeRange').fill('2'); await page.locator('#sizeRange').dispatchEvent('input'); await page.locator('#sizeRange').dispatchEvent('change');
    await page.evaluate(() => editor.save());
    const expected = await page.evaluate(() => {
      editor.capturePage(); return {pages:editor.pages.map(p => JSON.stringify(p.items)), pageIndex:editor.pageIndex};
    });
    await page.reload(); await page.evaluate(() => editor.ready);
    assert.deepEqual(await page.evaluate(() => ({pages:editor.pages.map(p=>JSON.stringify(p.items)),pageIndex:editor.pageIndex})), expected);
    assert.equal(await page.locator('#colors').inputValue(), '4'); assert(await page.locator('#invert').isChecked());
    const downloading = page.waitForEvent('download'); await page.locator('#downloadBtn').click();
    const download = await downloading; await download.saveAs(path.join(__dirname, 'output/browser-gallery.bin'));
    const bytes = fs.readFileSync(path.join(__dirname, 'output/browser-gallery.bin'));
    assert.equal(bytes.readUInt16LE(10), 2); assert.equal(bytes.readUInt32LE(12), bytes.length);
    assert.equal(bytes.readUInt32LE(24), 640); assert.equal(bytes.readUInt32LE(28), 480);
    await page.waitForFunction(() => !editor.exporting);
    // Saving failure is visible, and a subsequent transaction can recover.
    await page.evaluate(async () => {
      const original = GalleryStorage.save; GalleryStorage.save = async () => { throw new Error('Quota exceeded'); };
      try { await editor.save(); } catch (_) {} finally { GalleryStorage.save = original; }
    });
    assert.match(await page.locator('#saveStatus').innerText(), /Saving failed.*Quota/);
    await page.evaluate(() => editor.save());
    assert.equal(await page.locator('#saveStatus').innerText(), 'Saved locally');
    // Size advice does not disable export, including at maximum page count.
    await page.evaluate(async () => {
      editor.capturePage(); editor.pages.forEach(p => {p.binarySize=1200000; p.sizeSignature=`${editor.colors.value}:${editor.sizeRange.value}:${editor.invert.checked}`+JSON.stringify(p.items);});
      await editor.refreshBinarySize();
    });
    assert(await page.locator('#sizeWarning').isVisible()); assert(await page.locator('#downloadBtn').isEnabled());
    await page.screenshot({path:path.join(__dirname, 'output/editor.png'), fullPage:true});
    await page.locator('#removePageBtn').click(); await page.locator('#removePageBtn').click();
    assert.deepEqual(await page.evaluate(()=>[editor.pages.length, editor.items.length]), [1,0]);
    assert.deepEqual(errors, []);
    // Separate origin storage context: migrate the actual historical schema.
    const migrationContext = await browser.newContext();
    const migration = await migrationContext.newPage(); await migration.goto(url); await migration.evaluate(() => editor.ready);
    await migration.evaluate(image => {
      editor.storageWritable = false; // do not save empty initial state on reload
      localStorage.setItem('Cheatsheet:session:v2', JSON.stringify({sources:{i1:image},items:[{id:'i1',src:'i1',x:640,y:480,w:128,h:128,angle:0,fx:1,fy:1,crop:{x:0,y:0,w:128,h:128}}],nextId:2,colors:8,size:2,invert:false}));
    }, image);
    await migration.reload(); await migration.evaluate(() => editor.ready);
    assert.deepEqual(await migration.evaluate(() => [editor.pages.length,editor.items.length,localStorage.getItem('Cheatsheet:session:v2')]), [1,1,null]);
    await migration.reload(); await migration.evaluate(() => editor.ready);
    assert.equal(await migration.evaluate(() => editor.items.length), 1);
    // Failure during migration keeps the only historical copy.
    const failureContext = await browser.newContext();
    const failure = await failureContext.newPage(); await failure.goto(url); await failure.evaluate(() => editor.ready);
    await failure.evaluate(image => {
      editor.storageWritable=false;
      localStorage.setItem('Cheatsheet:session:v2',JSON.stringify({sources:{i1:image},items:[{id:'i1',src:'i1',x:640,y:480,w:128,h:128,angle:0,fx:1,fy:1,crop:{x:0,y:0,w:128,h:128}}],nextId:2}));
    },image);
    await failure.addInitScript(() => { IDBObjectStore.prototype.put = () => { throw new DOMException('Quota exceeded','QuotaExceededError'); }; });
    await failure.reload(); await failure.evaluate(() => editor.ready);
    assert.equal(await failure.evaluate(() => editor.items.length),1);
    assert(await failure.evaluate(() => !!localStorage.getItem('Cheatsheet:session:v2')));
    assert.match(await failure.locator('#saveStatus').innerText(), /Restore failed/);
    await failureContext.close();
    await page.setViewportSize({width:390,height:844});
    assert(await page.locator('#addPageBtn').isVisible());
    await page.screenshot({path:path.join(__dirname,'output/editor-mobile.png'),fullPage:true});
    await migrationContext.close(); await context.close();
    console.log('Browser: tools, independent histories, ordering, export, IndexedDB/reload, migration, quota error, empty pages and project asset paths PASS');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
