(() => {
const BW = 1280, BH = 960, MAXSRC = 2000, KEY = 'Cheatsheet:session:v2';
const IDS = ['pageSelect','addPageBtn','removePageBtn','pageUpBtn','pageDownBtn','sizeWarning','saveStatus','fileInput','orig','overlay','preview','lens','cropCanvas','rotateCanvas','cropModal','rotateModal','openBtn','undoBtn','redoBtn','rotateBtn','rotateCustomBtn','flipHBtn','flipVBtn','cropBtn','frontBtn','backBtn','deleteBtn','downloadBtn','downloadPreviewBtn','colors','colorsVal','invert','sizeRange','sizeVal','binSize','origSize','previewSize','statusText','outputSize','rotateAngle','rotateAngleVal','cropConfirm','cropCancel','cropCancel2','rotateConfirm','rotateCancel','rotateCancel2'];
const rad = (d) => d * Math.PI / 180;
const PAD = 32;       // free space around the board for handles of images that stick out
const ROT_GAP = 28;   // distance of the rotate handle below the image (screen px)

class Editor {
  constructor() {
    IDS.forEach((id) => { this[id] = document.getElementById(id); });
    this.octx = this.orig.getContext('2d');
    this.pctx = this.preview.getContext('2d');
    this.lctx = this.lens.getContext('2d');
    this.origWrap = this.orig.parentElement;
    this.prevWrap = this.preview.parentElement;
    this.orig.width = BW; this.orig.height = BH;
    this.board = this.orig; this.bctx = this.octx;          // the board is the original canvas itself
    this.vctx = this.overlay.getContext('2d'); this.dpr = 1;  // overlay: dimmed overflow + selection handles
    this.sources = new Map();   // id -> flattened source canvas
    this.items = [];            // {id, src, x, y, w, h, angle, fx, fy, crop}
    this.selId = null;
    this.nextId = 1;
    this.undoStack = []; this.redoStack = [];
    this.pages = [this.newPage()]; this.pageIndex = 0;
    this.storageWritable = true; this.saveRevision = 0;
    this.saveChain = Promise.resolve(); this.sizeGeneration = 0;
    this.exportBoard = document.createElement('canvas'); this.exportBoard.width = BW; this.exportBoard.height = BH;
    this.exportCanvas = document.createElement('canvas');
    document.querySelector('.app').inert = true;
    this.drag = null; this.cropSel = null; this.dispScale = 1;
    this.bind();
    this.ready = this.restore().then(() => {
      this.updateLabels();
      this.render(); this.updatePreview(); this.syncUi();
      if (this.items.length) this.updateStatus('Session restored');
      this.refreshPages(); document.querySelector('.app').inert = false;
    });
  }

  /* ---------- Events ---------- */
  bind() {
    const on = (el, ev, fn) => el.addEventListener(ev, fn);
    on(this.pageSelect, 'change', () => this.switchPage(Number(this.pageSelect.value)));
    on(this.addPageBtn, 'click', () => this.addPage());
    on(this.removePageBtn, 'click', () => this.removePage());
    on(this.pageUpBtn, 'click', () => this.movePage(-1));
    on(this.pageDownBtn, 'click', () => this.movePage(1));
    on(this.openBtn, 'click', () => this.fileInput.click());
    on(this.fileInput, 'change', async (e) => { await this.addFiles([...e.target.files]); e.target.value = ''; });
    on(this.undoBtn, 'click', () => this.undo());
    on(this.redoBtn, 'click', () => this.redo());
    on(this.rotateBtn, 'click', () => this.rotate90());
    on(this.rotateCustomBtn, 'click', () => this.openRotate());
    on(this.flipHBtn, 'click', () => this.flip('fx'));
    on(this.flipVBtn, 'click', () => this.flip('fy'));
    on(this.cropBtn, 'click', () => this.openCrop());
    on(this.frontBtn, 'click', () => this.reorder(1));
    on(this.backBtn, 'click', () => this.reorder(-1));
    on(this.deleteBtn, 'click', () => this.remove());
    on(this.downloadBtn, 'click', () => this.exportBinary());
    on(this.downloadPreviewBtn, 'click', () => this.exportPreviewPng());
    on(this.colors, 'input', () => { this.updateLabels(); this.schedulePreview(); });
    on(this.sizeRange, 'input', () => { this.updateLabels(); this.schedulePreview(); });
    on(this.invert, 'change', () => this.schedulePreview());
    ['change'].forEach((ev) => [this.colors, this.sizeRange, this.invert].forEach((el) => on(el, ev, () => this.scheduleSave())));

    on(this.overlay, 'pointerdown', (e) => this.onDown(e));
    on(this.overlay, 'pointermove', (e) => this.onMove(e));
    on(this.overlay, 'pointerup', () => this.onUp());
    on(this.overlay, 'pointercancel', () => this.onUp());
    on(this.origWrap, 'dragover', (e) => e.preventDefault());
    on(this.origWrap, 'drop', (e) => { e.preventDefault(); this.addFiles([...e.dataTransfer.files]); });

    // modals
    const close = (m) => () => this.closeModal(m);
    [this.cropCancel, this.cropCancel2].forEach((b) => on(b, 'click', close(this.cropModal)));
    [this.rotateCancel, this.rotateCancel2].forEach((b) => on(b, 'click', close(this.rotateModal)));
    on(this.cropConfirm, 'click', () => this.applyCrop());
    on(this.rotateConfirm, 'click', () => this.applyRotate());
    on(this.rotateAngle, 'input', () => this.drawRotate());
    on(this.cropCanvas, 'pointerdown', (e) => { this.cropStart = this.cropPt(e); this.cropSel = null; this.cropCanvas.setPointerCapture(e.pointerId); });
    on(this.cropCanvas, 'pointermove', (e) => {
      if (!this.cropStart) return;
      const p = this.cropPt(e), s = this.cropStart;
      this.cropSel = { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
      this.drawCrop();
    });
    on(this.cropCanvas, 'pointerup', () => { this.cropStart = null; });

    // keyboard, resize, saving
    window.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.render());
    window.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.save(); });

    // magnifier on preview
    on(this.prevWrap, 'mousemove', (e) => this.moveLens(e));
    on(this.prevWrap, 'mouseleave', () => this.lens.classList.remove('active'));
  }

  onKey(e) {
    if (this.importing || this.exporting) return;
    if (document.querySelector('.modal[aria-hidden="false"]')) {
      if (e.key === 'Escape') { this.closeModal(this.cropModal); this.closeModal(this.rotateModal); }
      return;
    }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); this.redo(); }
    else if (mod && k === 's') { e.preventDefault(); this.exportBinary(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) this.remove();
  }

  /* ---------- Gallery ---------- */
  newPage() { return {items: [], selId: null, undoStack: [], redoStack: []}; }
  capturePage() {
    Object.assign(this.pages[this.pageIndex], {items: this.items, selId: this.selId, undoStack: this.undoStack, redoStack: this.redoStack});
  }
  pageControlsAvailable() {
    return !this.importing && !this.exporting && !document.querySelector('.modal[aria-hidden="false"]');
  }
  activatePage(index) {
    this.pageIndex = index;
    const p = this.pages[index];
    this.items = p.items; this.selId = p.selId;
    this.undoStack = p.undoStack; this.redoStack = p.redoStack;
    this.drag = null; this.lens.classList.remove('active');
    this.render(); this.syncUi(); this.refreshPages();
  }
  switchPage(index) {
    if (!this.pageControlsAvailable() || !Number.isInteger(index) || index < 0 || index >= this.pages.length) return;
    this.capturePage(); this.activatePage(index); this.scheduleSave();
  }
  addPage() {
    if (!this.pageControlsAvailable() || this.pages.length >= GalleryFormat.MAX_PAGES) return;
    this.capturePage(); this.pages.push(this.newPage()); this.activatePage(this.pages.length - 1); this.scheduleSave();
  }
  removePage() {
    if (!this.pageControlsAvailable()) return;
    this.capturePage(); this.pages.splice(this.pageIndex, 1);
    if (!this.pages.length) this.pages.push(this.newPage());
    this.activatePage(Math.min(this.pageIndex, this.pages.length - 1)); this.scheduleSave();
  }
  movePage(direction) {
    const target = this.pageIndex + direction;
    if (!this.pageControlsAvailable() || target < 0 || target >= this.pages.length) return;
    this.capturePage();
    const [page] = this.pages.splice(this.pageIndex, 1); this.pages.splice(target, 0, page);
    this.activatePage(target); this.scheduleSave();
  }
  refreshPages() {
    this.pageSelect.replaceChildren(...this.pages.map((p, i) => {
      const option = document.createElement('option'); option.value = i;
      option.textContent = `Page ${i + 1} / ${this.pages.length}${p.items.length ? '' : ' (empty)'}`; return option;
    }));
    this.pageSelect.value = this.pageIndex;
    const busy = !this.pageControlsAvailable();
    this.pageSelect.disabled = busy;
    this.addPageBtn.disabled = busy || this.pages.length >= GalleryFormat.MAX_PAGES;
    this.removePageBtn.disabled = busy;
    this.pageUpBtn.disabled = busy || this.pageIndex === 0;
    this.pageDownBtn.disabled = busy || this.pageIndex + 1 === this.pages.length;
  }
  async addFiles(files) {
    if (this.importing || this.exporting) return;
    this.importing = true; document.querySelector('.app').inert = true; this.refreshPages();
    try { await this._addFiles(files); }
    finally { this.importing = false; document.querySelector('.app').inert = false; this.capturePage(); this.refreshPages(); }
  }

  /* ---------- Model helpers ---------- */
  sel() { return this.items.find((i) => i.id === this.selId) || null; }
  need() { const it = this.sel(); if (!it) this.updateStatus('Select an image on the original first.'); return it; }
  snap() { return JSON.stringify({ items: this.items, sel: this.selId }); }
  load(s) { const o = JSON.parse(s); this.items = o.items; this.selId = o.sel; }
  pushHistory() { this.undoStack.push(this.snap()); this.redoStack = []; if (this.undoStack.length > 60) this.undoStack.shift(); }
  changed(msg) { const it = this.sel(); if (it) this.keepReachable(it); this.render(); this.syncUi(); this.updateStatus(msg); this.scheduleSave(); }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snap()); this.load(this.undoStack.pop());
    this.changed('Undone');
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snap()); this.load(this.redoStack.pop());
    this.changed('Redone');
  }

  loadImage(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); res(img); };
      img.onerror = (e) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
  }

  async _addFiles(files) {
    files = files.filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    this.pushHistory();
    let added = 0;
    for (const f of files) {
      try {
        const img = await this.loadImage(URL.createObjectURL(f));
        const k = Math.min(1, MAXSRC / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        const id = 'i' + this.nextId++;
        this.sources.set(id, c);
        const s = Math.min(1, BW * 0.8 / c.width, BH * 0.8 / c.height), off = (this.items.length % 8) * 30;
        this.items.push({ id, src: id, x: BW / 2 + off, y: BH / 2 + off, w: c.width * s, h: c.height * s, angle: 0, fx: 1, fy: 1, crop: { x: 0, y: 0, w: c.width, h: c.height } });
        this.selId = id; added++;
      } catch (e) { this.updateStatus(`Could not read ${f.name}.`); }
    }
    if (!added) { this.undoStack.pop(); return; }
    this.changed(`${added} image${added > 1 ? 's' : ''} added`);
  }

  /* ---------- Selected image actions ---------- */
  rotate90() {
    const it = this.need(); if (!it) return;
    this.pushHistory(); it.angle = (it.angle + 90) % 360;
    this.changed('Rotated 90°');
  }
  flip(axis) {
    const it = this.need(); if (!it) return;
    this.pushHistory(); it[axis] *= -1; it.angle = -it.angle;   // mirror in screen space
    this.changed(axis === 'fx' ? 'Flipped horizontally' : 'Flipped vertically');
  }
  reorder(dir) {
    const it = this.need(); if (!it) return;
    const i = this.items.indexOf(it), j = Math.max(0, Math.min(this.items.length - 1, i + dir));
    if (i === j) return;
    this.pushHistory(); this.items.splice(i, 1); this.items.splice(j, 0, it);
    this.changed(dir > 0 ? 'Brought forward' : 'Sent backward');
  }
  remove() {
    const it = this.sel(); if (!it) return;
    this.pushHistory(); this.items = this.items.filter((i) => i !== it); this.selId = null;
    this.changed('Image removed');
  }

  /* ---------- Board pointer interaction ---------- */
  toBoard(e) {
    const r = this.orig.getBoundingClientRect();
    return { x: (e.clientX - r.left) * BW / r.width, y: (e.clientY - r.top) * BH / r.height, k: BW / r.width };
  }
  local(it, p) {
    const a = rad(-it.angle), dx = p.x - it.x, dy = p.y - it.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  // Resize handles: corners first, then edge midpoints (edges skipped when too short)
  handleList(it, r) {
    const c = [], e = [];
    for (const hy of [-1, 0, 1]) for (const hx of [-1, 0, 1]) {
      if (!hx && !hy) continue;
      if (!(hx && hy) && (hx ? it.h : it.w) <= 4 * r) continue;
      (hx && hy ? c : e).push({ hx, hy, x: hx * it.w / 2, y: hy * it.h / 2 });
    }
    return c.concat(e);
  }
  hit(p) {
    const s = this.sel(), r = 9 * p.k;
    if (s) {
      const l = this.local(s, p);
      if (Math.hypot(l.x, l.y - (s.h / 2 + ROT_GAP * p.k)) <= r) return { it: s, handle: { rot: true } };
      const h = this.handleList(s, r).find((q) => Math.hypot(l.x - q.x, l.y - q.y) <= r);
      if (h) return { it: s, handle: h };
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], l = this.local(it, p);
      if (Math.abs(l.x) <= it.w / 2 && Math.abs(l.y) <= it.h / 2) return { it, handle: null };
    }
    return null;
  }
  cursorFor(h, it) {
    if (h.rot) return 'grab';
    let a = Math.atan2(h.hy, h.hx) * 180 / Math.PI + it.angle;
    a = ((a % 180) + 180) % 180;
    return a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize';
  }
  onDown(e) {
    if (e.button !== 0) return;
    const p = this.toBoard(e), h = this.hit(p);
    this.selId = h ? h.it.id : null;
    if (h) {
      this.drag = { mode: !h.handle ? 'move' : h.handle.rot ? 'rot' : 'size', hd: h.handle, id: h.it.id, p0: p, it0: { ...h.it }, pending: this.snap() };
      this.overlay.setPointerCapture(e.pointerId);
    }
    this.draw(); this.syncUi();
  }
  onMove(e) {
    const p = this.toBoard(e), d = this.drag;
    if (!d) {
      const h = this.hit(p);
      this.overlay.style.cursor = !h ? 'default' : h.handle ? this.cursorFor(h.handle, h.it) : 'move';
      return;
    }
    if (d.pending) {
      if (Math.hypot(p.x - d.p0.x, p.y - d.p0.y) < 3 * p.k) return;
      this.undoStack.push(d.pending); this.redoStack = []; d.pending = null;
    }
    const it = this.sel(); if (!it) return;
    const o = d.it0;
    if (d.mode === 'move') {
      it.x = o.x + p.x - d.p0.x; it.y = o.y + p.y - d.p0.y;
      this.keepReachable(it);
    } else if (d.mode === 'rot') {
      let a = Math.atan2(p.y - o.y, p.x - o.x) * 180 / Math.PI - 90;
      a = ((a + 540) % 360) - 180;
      const s90 = Math.round(a / 90) * 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(a - s90) < 3) a = s90;
      it.angle = a;
      this.keepReachable(it);
    } else {
      // opposite edge/corner stays fixed; corners keep the ratio unless Shift is held
      const vis = this.visible(), g = ROT_GAP * p.k;
      const q = { x: Math.min(Math.max(p.x, vis.minX + g), vis.maxX - g), y: Math.min(Math.max(p.y, vis.minY + g), vis.maxY - g) };
      const { hx, hy } = d.hd, l = this.local(o, q), MIN = 8;
      const ax = -hx * o.w / 2, ay = -hy * o.h / 2;
      let w = o.w, h = o.h, cx = 0, cy = 0;
      if (hx) w = Math.max(MIN, hx * (l.x - ax));
      if (hy) h = Math.max(MIN, hy * (l.y - ay));
      if (hx && hy && !e.shiftKey) { const k = Math.max(w / o.w, h / o.h); w = o.w * k; h = o.h * k; }
      if (hx) cx = ax + hx * w / 2;
      if (hy) cy = ay + hy * h / 2;
      const r = rad(o.angle);
      it.w = w; it.h = h;
      it.x = o.x + cx * Math.cos(r) - cy * Math.sin(r);
      it.y = o.y + cx * Math.sin(r) + cy * Math.cos(r);
    }
    this.render(); this.syncUi();
  }
  onUp() {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.pending) { if (d.mode === 'rot') this.rotate90(); return; }   // click on the rotate handle = 90°
    this.scheduleSave();
  }

  /* ---------- Rendering ---------- */
  drawItem(x, it) {
    x.save();
    x.translate(it.x, it.y); x.rotate(rad(it.angle)); x.scale(it.fx, it.fy);
    x.drawImage(this.sources.get(it.src), it.crop.x, it.crop.y, it.crop.w, it.crop.h, -it.w / 2, -it.h / 2, it.w, it.h);
    x.restore();
  }
  fit() {
    const place = (cv, wrap, w, h, pad) => {
      const k = Math.max(0.05, Math.min(8, (wrap.clientWidth - 2 * pad) / w, (wrap.clientHeight - 2 * pad) / h));
      cv.style.width = Math.round(w * k) + 'px'; cv.style.height = Math.round(h * k) + 'px';
      return k;
    };
    this.dispScale = place(this.orig, this.origWrap, BW, BH, PAD);
    place(this.preview, this.prevWrap, this.preview.width, this.preview.height, 12);   // also scales up small previews
    const dpr = window.devicePixelRatio || 1, cw = Math.round(this.origWrap.clientWidth * dpr), ch = Math.round(this.origWrap.clientHeight * dpr);
    this.dpr = dpr;
    if (this.overlay.width !== cw || this.overlay.height !== ch) { this.overlay.width = cw; this.overlay.height = ch; }
  }
  // board <-> overlay geometry
  view() {
    const o = this.orig.getBoundingClientRect(), v = this.overlay.getBoundingClientRect();
    return { ox: o.left - v.left, oy: o.top - v.top, ds: o.width / BW || 1 };
  }
  visible() {   // visible area of the overlay, in board coordinates
    const v = this.view(), k = 1 / v.ds, m = 8 * k, cw = this.overlay.width / this.dpr, ch = this.overlay.height / this.dpr;
    return { minX: -v.ox * k + m, maxX: (cw - v.ox) * k - m, minY: -v.oy * k + m, maxY: (ch - v.oy) * k - m };
  }
  // shift the image so that all its handles stay inside the visible area
  keepReachable(it) {
    if (this.overlay.width < 10) return;
    const vis = this.visible(), k = 1 / this.view().ds, a = rad(it.angle), c = Math.cos(a), s = Math.sin(a);
    const pts = [];
    const add = (lx, ly) => pts.push([it.x + lx * c - ly * s, it.y + lx * s + ly * c]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) add(sx * it.w / 2, sy * it.h / 2);
    add(0, it.h / 2 + (ROT_GAP + 8) * k);
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const fix = (lo, hi, vmin, vmax) => (hi - lo > vmax - vmin) ? (vmin + vmax) / 2 - (lo + hi) / 2 : lo < vmin ? vmin - lo : hi > vmax ? vmax - hi : 0;
    it.x += fix(x0, x1, vis.minX, vis.maxX);
    it.y += fix(y0, y1, vis.minY, vis.maxY);
  }
  render() {
    const x = this.bctx;
    x.fillStyle = '#fff'; x.fillRect(0, 0, BW, BH);
    this.items.forEach((it) => this.drawItem(x, it));
    this.fit(); this.draw(); this.schedulePreview();
  }
  draw() {
    const x = this.vctx, v = this.view(), k = 1 / v.ds, it = this.sel();
    const cw = this.overlay.width / this.dpr, ch = this.overlay.height / this.dpr;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.clearRect(0, 0, cw, ch);
    // parts of images that stick out of the board, dimmed
    x.save();
    x.beginPath(); x.rect(0, 0, cw, ch); x.rect(v.ox, v.oy, BW * v.ds, BH * v.ds); x.clip('evenodd');
    x.translate(v.ox, v.oy); x.scale(v.ds, v.ds); x.globalAlpha = 0.4;
    this.items.forEach((i) => this.drawItem(x, i));
    x.restore();
    if (!it) return;
    x.save();
    x.translate(v.ox, v.oy); x.scale(v.ds, v.ds);
    x.translate(it.x, it.y); x.rotate(rad(it.angle));
    x.strokeStyle = '#2f6df6'; x.fillStyle = '#fff'; x.lineWidth = 1.5 * k;
    x.setLineDash([6 * k, 4 * k]); x.strokeRect(-it.w / 2, -it.h / 2, it.w, it.h); x.setLineDash([]);
    const h = 9 * k;
    for (const q of this.handleList(it, h)) {
      x.fillRect(q.x - h / 2, q.y - h / 2, h, h);
      x.strokeRect(q.x - h / 2, q.y - h / 2, h, h);
    }
    // rotate handle below the image
    const ry = it.h / 2 + ROT_GAP * k;
    x.beginPath(); x.moveTo(0, it.h / 2); x.lineTo(0, ry - 6 * k); x.stroke();
    x.beginPath(); x.arc(0, ry, 7 * k, 0, Math.PI * 2); x.fill(); x.stroke();
    x.beginPath(); x.arc(0, ry, 3.2 * k, 0.4 * Math.PI, 1.8 * Math.PI); x.stroke();
    x.restore();
  }

  schedulePreview() { clearTimeout(this.pt); this.pt = setTimeout(() => this.updatePreview(), 60); }

  // Same quantization as before: board -> W×H, mean of RGB -> N gray levels
  updatePreview() {
    clearTimeout(this.pt);
    const mult = Math.max(1, Math.min(12, parseInt(this.sizeRange.value || 4, 10)));
    const W = 320 * mult, H = 240 * mult;
    this.preview.width = W; this.preview.height = H;
    this.pctx.clearRect(0, 0, W, H);
    this.pctx.drawImage(this.board, 0, 0, BW, BH, 0, 0, W, H);
    const data = this.pctx.getImageData(0, 0, W, H);
    const ncolors = parseInt(this.colors.value || 16, 10);
    const invert = this.invert.checked;
    for (let i = 0; i < data.data.length; i += 4) {
      const intensity = Math.round((data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3);
      let idx = Math.round(intensity / 255 * (ncolors - 1));
      if (invert) idx = (ncolors - 1) - idx;
      const gray = Math.round(idx / (ncolors - 1) * 255);
      data.data[i] = data.data[i + 1] = data.data[i + 2] = gray;
    }
    this.pctx.putImageData(data, 0, 0);
    this.fit();
    this.previewSize.textContent = `${W}×${H}`;
    this.refreshBinarySize();
  }

  updateLabels() {
    this.colorsVal.textContent = this.colors.value;
    this.sizeVal.textContent = this.sizeRange.value;
    const m = parseInt(this.sizeRange.value, 10);
    this.outputSize.textContent = `${320 * m}×${240 * m}`;
  }
  updateStatus(t) { this.statusText.textContent = t; }
  syncUi() {
    const has = !!this.sel();
    [this.rotateBtn, this.rotateCustomBtn, this.flipHBtn, this.flipVBtn, this.cropBtn, this.frontBtn, this.backBtn, this.deleteBtn].forEach((b) => { b.disabled = !has; });
    this.undoBtn.disabled = !this.undoStack.length;
    this.redoBtn.disabled = !this.redoStack.length;
    const n = this.items.length;
    this.origSize.textContent = !n ? '—' : `${n} image${n > 1 ? 's' : ''}${has ? ', 1 selected' : ''}`;
  }

  moveLens(e) {
    const r = this.preview.getBoundingClientRect(), w = this.prevWrap.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { this.lens.classList.remove('active'); return; }
    const ds = r.width / this.preview.width, sw = 50 / ds;
    const px = (e.clientX - r.left) / ds, py = (e.clientY - r.top) / ds;
    this.lctx.imageSmoothingEnabled = false;
    this.lctx.clearRect(0, 0, 200, 200);
    this.lctx.drawImage(this.preview, px - sw / 2, py - sw / 2, sw, sw, 0, 0, 200, 200);
    this.lens.style.left = (e.clientX - w.left) + 'px';
    this.lens.style.top = (e.clientY - w.top) + 'px';
    this.lens.classList.add('active');
  }

  /* ---------- Crop modal (selected image only) ---------- */
  openModal(m) { m.setAttribute('aria-hidden', 'false'); this.refreshPages(); }
  closeModal(m) { m.setAttribute('aria-hidden', 'true'); this.cropStart = null; this.refreshPages(); }
  cropPt(e) {
    const r = this.cropCanvas.getBoundingClientRect(), c = this.cropCanvas;
    return { x: Math.max(0, Math.min(c.width, (e.clientX - r.left) * c.width / r.width)), y: Math.max(0, Math.min(c.height, (e.clientY - r.top) * c.height / r.height)) };
  }
  openCrop() {
    const it = this.need(); if (!it) return;
    const c = it.crop, s = Math.min(1, innerWidth * 0.8 / c.w, innerHeight * 0.6 / c.h);
    this.cropCanvas.width = Math.max(40, Math.round(c.w * s));
    this.cropCanvas.height = Math.max(40, Math.round(c.h * s));
    this.cropSel = null; this.drawCrop(); this.openModal(this.cropModal);
  }
  drawCrop() {
    const it = this.sel(), c = it.crop, cv = this.cropCanvas, x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    x.save(); x.translate(it.fx < 0 ? W : 0, it.fy < 0 ? H : 0); x.scale(it.fx, it.fy);
    x.drawImage(this.sources.get(it.src), c.x, c.y, c.w, c.h, 0, 0, W, H);
    x.restore();
    const s = this.cropSel; if (!s) return;
    x.save();
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.rect(0, 0, W, H); x.rect(s.x, s.y, s.w, s.h); x.fill('evenodd');
    x.strokeStyle = '#7aa7ff'; x.lineWidth = 2; x.strokeRect(s.x, s.y, s.w, s.h);
    x.restore();
  }
  applyCrop() {
    const it = this.sel(), s = this.cropSel;
    if (!it || !s || s.w < 4 || s.h < 4) { this.closeModal(this.cropModal); return; }
    const c = it.crop, W = this.cropCanvas.width, H = this.cropCanvas.height, mx = W / c.w, my = H / c.h;
    const sx = it.fx < 0 ? W - (s.x + s.w) : s.x, sy = it.fy < 0 ? H - (s.y + s.h) : s.y;
    const nc = { x: c.x + sx / mx, y: c.y + sy / my, w: s.w / mx, h: s.h / my };
    const kx = it.w / c.w, ky = it.h / c.h;
    // keep the kept pixels where they were on the board
    const vx = (nc.x + nc.w / 2 - c.x - c.w / 2) * kx * it.fx, vy = (nc.y + nc.h / 2 - c.y - c.h / 2) * ky * it.fy, a = rad(it.angle);
    this.pushHistory();
    it.x += vx * Math.cos(a) - vy * Math.sin(a);
    it.y += vx * Math.sin(a) + vy * Math.cos(a);
    it.w = nc.w * kx; it.h = nc.h * ky; it.crop = nc;
    this.closeModal(this.cropModal);
    this.changed('Image cropped');
  }

  /* ---------- Free rotation modal (selected image only) ---------- */
  openRotate() {
    const it = this.need(); if (!it) return;
    const a = Math.round(((it.angle % 360) + 540) % 360 - 180);
    this.rotateAngle.value = a;
    const size = Math.round(Math.max(240, Math.min(innerWidth * 0.8, innerHeight * 0.5, 640)));
    this.rotateCanvas.width = this.rotateCanvas.height = size;
    this.drawRotate(); this.openModal(this.rotateModal);
  }
  drawRotate() {
    const it = this.sel(); if (!it) return;
    const a = parseInt(this.rotateAngle.value, 10), cv = this.rotateCanvas, x = cv.getContext('2d');
    this.rotateAngleVal.textContent = a;
    const k = Math.min(2, cv.width / Math.hypot(it.w, it.h));
    x.clearRect(0, 0, cv.width, cv.height);
    x.save(); x.translate(cv.width / 2, cv.height / 2); x.rotate(rad(a)); x.scale(it.fx, it.fy);
    x.drawImage(this.sources.get(it.src), it.crop.x, it.crop.y, it.crop.w, it.crop.h, -it.w * k / 2, -it.h * k / 2, it.w * k, it.h * k);
    x.restore();
  }
  applyRotate() {
    const it = this.sel(); if (!it) return;
    this.pushHistory(); it.angle = parseInt(this.rotateAngle.value, 10);
    this.closeModal(this.rotateModal);
    this.changed(`Rotated to ${it.angle}°`);
  }

  /* ---------- Binary size + export (unchanged RLE logic) ---------- */
  encodePage(page) {
    const board = this.exportBoard, ctx = board.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, BW, BH);
    page.items.forEach(it => this.drawItem(ctx, it));
    const mult = Math.max(1, Math.min(12, Number(this.sizeRange.value)));
    const canvas = this.exportCanvas; canvas.width = mult * 320; canvas.height = mult * 240;
    const x = canvas.getContext('2d'); x.drawImage(board, 0, 0, canvas.width, canvas.height);
    return {width: canvas.width, height: canvas.height,
      bytes: GalleryFormat.encodeRGBA(x.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width, canvas.height, Number(this.colors.value), this.invert.checked)};
  }
  async refreshBinarySize() {
    const generation = ++this.sizeGeneration;
    this.capturePage();
    let total = 16 + this.pages.length * 16;
    const options = `${this.colors.value}:${this.sizeRange.value}:${this.invert.checked}`;
    try {
      for (const page of this.pages) {
        if (generation !== this.sizeGeneration) return;
        const signature = options + JSON.stringify(page.items);
        if (page.sizeSignature !== signature) {
          page.binarySize = page.items.length ? this.encodePage(page).bytes.length : 0;
          page.sizeSignature = signature;
        }
        total += page.binarySize;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (generation !== this.sizeGeneration) return;
      this.binSize.textContent = this.formatFileSize(total);
      this.sizeWarning.hidden = !GalleryFormat.needsWarning(total);
    } catch (e) { this.updateStatus(`Cannot estimate gallery size: ${e.message}`); }
  }
  formatFileSize(bytes) {
    if (!bytes) return '0 o';
    if (Math.abs(bytes) < 1024) return bytes + ' o';
    const units = ['ko', 'Mo', 'Go']; let u = -1;
    do { bytes /= 1024; ++u; } while (Math.abs(bytes) >= 1024 && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
  }
  download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  async exportBinary() {
    if (this.exporting || this.importing) return;
    this.capturePage();
    const empty = this.pages.findIndex(p => !p.items.length);
    if (empty >= 0) { this.updateStatus(`Page ${empty + 1} is empty. Add an image or remove this page before exporting.`); return; }
    this.exporting = true; document.querySelector('.app').inert = true; this.refreshPages();
    ++this.sizeGeneration; clearTimeout(this.pt);
    try {
      const encoded = [];
      for (let i = 0; i < this.pages.length; ++i) {
        this.updateStatus(`Exporting page ${i + 1} / ${this.pages.length}…`);
        await new Promise(resolve => setTimeout(resolve, 0));
        encoded.push(this.encodePage(this.pages[i]));
      }
      const bytes = GalleryFormat.pack(encoded);
      this.binSize.textContent = this.formatFileSize(bytes.length);
      this.sizeWarning.hidden = !GalleryFormat.needsWarning(bytes.length);
      this.download(new Blob([bytes], {type: 'application/octet-stream'}), 'gallery.bin');
      this.updateStatus(`Gallery exported: ${this.pages.length} pages, ${this.formatFileSize(bytes.length)}.`);
    } catch (e) { this.updateStatus(`Export failed: ${e.message}`); }
    finally { this.exporting = false; document.querySelector('.app').inert = false; this.refreshPages(); }
  }
  exportPreviewPng() {
    if (!this.items.length) { alert('Add an image first'); return; }
    this.updatePreview();
    this.preview.toBlob((b) => { this.download(b, 'preview.png'); this.updateStatus('PNG preview exported'); });
  }

  /* ---------- Session ---------- */
  scheduleSave() { ++this.saveRevision; this.storageWritable = true; clearTimeout(this.st); this.saveStatus.textContent = 'Changes not saved yet'; this.st = setTimeout(() => this.save(), 500); }
  save() {
    if (!this.storageWritable) return Promise.resolve();
    clearTimeout(this.st); this.capturePage();
    const pages = this.pages.map(p => ({items: structuredClone(p.items), selId: p.selId,
      undoStack: [...p.undoStack], redoStack: [...p.redoStack]}));
    const ids = new Set();
    pages.forEach(p => {
      p.items.forEach(it => ids.add(it.src));
      [...p.undoStack, ...p.redoStack].forEach(s => JSON.parse(s).items.forEach(it => ids.add(it.src)));
    });
    const sources = [...ids].map(id => [id, this.sources.get(id)]);
    const state = {version: 3, pages, pageIndex: this.pageIndex, nextId: this.nextId,
      colors: this.colors.value, size: this.sizeRange.value, invert: this.invert.checked};
    const revision = ++this.saveRevision;
    this.saveStatus.textContent = 'Saving…';
    const task = async () => {
      const blobs = {};
      for (const [id, canvas] of sources) {
        if (!canvas) throw new Error('Missing image source');
        blobs[id] = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image saving failed')), 'image/png'));
      }
      await GalleryStorage.save({...state, sources: blobs});
    };
    const result = this.saveChain.catch(() => {}).then(task);
    this.saveChain = result;
    result.then(() => { if (revision === this.saveRevision) this.saveStatus.textContent = 'Saved locally'; }, e => {
      if (revision !== this.saveRevision) return;
      this.saveStatus.textContent = `Saving failed: ${e.message}. Export your gallery to keep a copy.`;
    });
    return result;
  }
  async restore() {
    try {
      let state = await GalleryStorage.load(), legacy = false;
      if (!state) {
        const old = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!old) { this.saveStatus.textContent = 'No saved gallery yet'; return; }
        state = {...old, version: 3, pages: [{items: old.items || [], selId: null, undoStack: [], redoStack: []}], pageIndex: 0}; legacy = true;
      }
      if (state.version !== 3 || !Array.isArray(state.pages) || !state.pages.length || state.pages.length > GalleryFormat.MAX_PAGES) throw new Error('Invalid saved gallery');
      const sources = new Map();
      for (const [id, value] of Object.entries(state.sources || {})) {
        if (!(value instanceof Blob) && typeof value !== 'string') throw new Error('Invalid saved image');
        const img = await this.loadImage(value instanceof Blob ? URL.createObjectURL(value) : value);
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > MAXSRC || img.naturalHeight > MAXSRC) throw new Error('Saved image exceeds source limits');
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0); sources.set(id, c);
      }
      const validateItems = items => {
        if (!Array.isArray(items)) throw new Error('Invalid saved page');
        const ids = new Set();
        for (const it of items) {
          const source = sources.get(it.src), crop = it.crop;
          if (typeof it.id !== 'string' || ids.has(it.id) || !source ||
              !['x','y','w','h','angle','fx','fy'].every(k => Number.isFinite(it[k])) ||
              it.w <= 0 || it.h <= 0 || ![-1,1].includes(it.fx) || ![-1,1].includes(it.fy) ||
              !crop || !['x','y','w','h'].every(k => Number.isFinite(crop[k])) ||
              crop.x < 0 || crop.y < 0 || crop.w <= 0 || crop.h <= 0 ||
              crop.x + crop.w > source.width + 1e-6 || crop.y + crop.h > source.height + 1e-6) throw new Error('Invalid saved image geometry');
          ids.add(it.id);
        }
      };
      state.pages.forEach(p => {
        validateItems(p.items);
        p.undoStack = p.undoStack || []; p.redoStack = p.redoStack || [];
        for (const history of [p.undoStack, p.redoStack]) {
          if (!Array.isArray(history) || history.length > 60) throw new Error('Invalid saved history');
          history.forEach(snapshot => validateItems(JSON.parse(snapshot).items));
        }
      });
      this.sources = sources; this.pages = state.pages;
      this.nextId = Number.isSafeInteger(state.nextId) && state.nextId > 0 ? state.nextId : 1;
      sources.forEach((_, id) => { this.nextId = Math.max(this.nextId, (Number(id.slice(1)) || 0) + 1); });
      if (Number(state.colors) >= 2 && Number(state.colors) <= 16) this.colors.value = state.colors;
      if (Number(state.size) >= 1 && Number(state.size) <= 12) this.sizeRange.value = state.size;
      this.invert.checked = !!state.invert;
      const index = Number.isInteger(state.pageIndex) && state.pageIndex >= 0 && state.pageIndex < this.pages.length ? state.pageIndex : 0;
      this.activatePage(index);
      if (legacy) { await this.save(); localStorage.removeItem(KEY); }
      this.saveStatus.textContent = 'Saved gallery restored';
    } catch (e) { this.storageWritable = false; this.saveStatus.textContent = `Restore failed: ${e.message}. Previous saved data has been kept.`; }
  }
}

document.addEventListener('DOMContentLoaded', () => { window.editor = new Editor(); });
})();
