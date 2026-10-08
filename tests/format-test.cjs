const assert = require('node:assert/strict');
const fs = require('node:fs');
const format = require('../docs/gallery-format.js');
function image(kind) {
 const width=640,height=480,rgba=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4, g=kind===0?(x<320?20:230):kind===1?(y<240?0:255):(x+y)%256;
  rgba[i]=rgba[i+1]=rgba[i+2]=g;rgba[i+3]=255;
 }
 return {width,height,bytes:format.encodeRGBA(rgba,width,height)};
}
function unpack(file) {
 const view=new DataView(file.buffer,file.byteOffset,file.byteLength),n=view.getUint16(10,true),pages=[];
 for(let i=0;i<n;i++){const e=16+i*16,off=view.getUint32(e,true),len=view.getUint32(e+4,true);pages.push(file.slice(off,off+len));}return pages;
}
const pages=[image(0),image(1),image(2)],bin=format.pack(pages);
assert.deepEqual(unpack(bin),pages.map(p=>p.bytes));
assert.deepEqual(unpack(format.pack([...pages].reverse())),pages.map(p=>p.bytes).reverse());
fs.writeFileSync('tests/fixtures/gallery.bin',bin);
const white=new Uint8Array(320*240*4).fill(255);
assert.deepEqual(format.encodeRGBA(white,320,240),new Uint8Array(fs.readFileSync('tests/fixtures/legacy-white.bin')));
assert.deepEqual(format.encodeRGBA(white,320,240,16,true),new Uint8Array(fs.readFileSync('tests/fixtures/legacy-black.bin')));
for(const colors of [2,3,8,16]){const rgba=new Uint8Array(320*240*4).fill(90);const a=format.encodeRGBA(rgba,320,240,colors),b=format.encodeRGBA(rgba,320,240,colors,true);const level=Math.round(90/255*(colors-1));assert.equal(a[0]&15,Math.round(level/(colors-1)*15));assert.equal(b[0]&15,Math.round((colors-1-level)/(colors-1)*15));}
assert(!format.needsWarning(Math.floor(format.WARNING_BYTES)));assert(format.needsWarning(Math.ceil(format.WARNING_BYTES)));
assert.throws(()=>format.pack([]));assert.throws(()=>format.pack(Array(256).fill(pages[0])));
const maxGallery=format.pack(Array(255).fill(pages[0]));assert.equal(unpack(maxGallery).length,255);fs.writeFileSync('tests/output/max-gallery.bin',maxGallery);
assert.throws(()=>format.encodeRGBA(white,321,240));
console.log('JS format: encoding, legacy equivalence, ordering, global settings, count/size limits PASS');
