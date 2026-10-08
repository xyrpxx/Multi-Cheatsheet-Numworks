/* Shared encoder contract: see docs/gallery-format.md. No DOM dependency. */
(function (root) {
  'use strict';
  const MAX_PAGES = 255, WARNING_BYTES = 2.2 * 1024 * 1024;
  const MAGIC = [77, 67, 83, 72, 66, 73, 78, 0];
  function encodeRGBA(rgba, width, height, colors = 16, invert = false) {
    if (!Number.isInteger(width) || width < 320 || width > 3840 || width % 320 ||
        !Number.isInteger(height) || height < 240 || height > 2880 || height % 240 ||
        !Number.isInteger(colors) || colors < 2 || colors > 16 || rgba.length !== width * height * 4) throw new Error('Invalid image dimensions or palette');
    const out = new Uint8Array(width * height);
    let used = 0;
    const pixel = (i) => {
      const mean = Math.round((rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3);
      let level = Math.round(mean / 255 * (colors - 1));
      if (invert) level = colors - 1 - level;
      return Math.round(level / (colors - 1) * 15);
    };
    for (let y = 0; y < height; ++y) {
      for (let chunk = 0; chunk < width; chunk += 320) {
        let cur = pixel((y * width + chunk) * 4), run = 1;
        for (let x = chunk + 1; x < chunk + 320; ++x) {
          const value = pixel((y * width + x) * 4);
          if (value === cur && run < 16) ++run;
          else { out[used++] = (run - 1) << 4 | cur; cur = value; run = 1; }
        }
        out[used++] = (run - 1) << 4 | cur;
      }
    }
    return out.slice(0, used);
  }
  function pack(pages) {
    if (!pages.length || pages.length > MAX_PAGES) throw new Error('Invalid page count');
    const size = 16 + 16 * pages.length + pages.reduce((s, p) => s + p.bytes.length, 0);
    if (!Number.isSafeInteger(size) || size > 0xffffffff) throw new Error('File exceeds format limits');
    const out = new Uint8Array(size), v = new DataView(out.buffer);
    out.set(MAGIC); v.setUint16(8, 2, true); v.setUint16(10, pages.length, true); v.setUint32(12, size, true);
    let offset = 16 + 16 * pages.length;
    pages.forEach((p, i) => {
      if (!(p.bytes instanceof Uint8Array) || !p.bytes.length || !Number.isInteger(p.width) || p.width < 320 || p.width > 3840 || p.width % 320 || !Number.isInteger(p.height) || p.height < 240 || p.height > 2880 || p.height % 240) throw new Error('Invalid page');
      const e = 16 + 16 * i;
      v.setUint32(e, offset, true); v.setUint32(e + 4, p.bytes.length, true);
      v.setUint32(e + 8, p.width, true); v.setUint32(e + 12, p.height, true);
      out.set(p.bytes, offset); offset += p.bytes.length;
    });
    return out;
  }
  const api = {MAX_PAGES, WARNING_BYTES, encodeRGBA, pack, needsWarning: bytes => bytes > WARNING_BYTES};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GalleryFormat = api;
})(globalThis);
