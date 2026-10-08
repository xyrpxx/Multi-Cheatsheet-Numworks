#include "../src/gallery.h"
#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <string.h>
static unsigned char *read_file(const char *name, size_t *n) {
 FILE *f=fopen(name,"rb"); assert(f); fseek(f,0,SEEK_END); *n=ftell(f); rewind(f);
 unsigned char *p=malloc(*n); assert(p); assert(fread(p,1,*n,f)==*n); fclose(f); return p;
}
int main(void) {
 Gallery g; GalleryPage p; size_t n;
 const char *legacy[]={"tests/fixtures/legacy-white.bin","tests/fixtures/legacy-black.bin","tests/fixtures/input-original.bin"};
 for (unsigned i=0;i<3;i++){unsigned char *b=read_file(legacy[i],&n); assert(gallery_init(&g,b,n)); assert(g.legacy && g.count==1); assert(gallery_page(&g,0,&p)); assert(!gallery_page(&g,1,&p)); free(b);}
 unsigned char *b=read_file("tests/fixtures/gallery.bin",&n), *copy=malloc(n); assert(copy);
 assert(gallery_init(&g,b,n)&&!g.legacy&&g.count==3);
 for(unsigned i=0;i<3;i++){assert(gallery_page(&g,i,&p)); assert(p.width==640&&p.height==480&&p.chunks==960);}
 for(size_t i=8;i<n;i++) assert(!gallery_init(&g,b,i));
 const unsigned offsets[]={8,10,11,12,16,20,24,28,32};
 for(unsigned i=0;i<sizeof(offsets)/sizeof(*offsets);i++){memcpy(copy,b,n);copy[offsets[i]]^=0xff;assert(!gallery_init(&g,copy,n));}
 memset(copy,0xff,n);assert(!gallery_init(&g,copy,n));
 memcpy(copy,b,n);copy[10]=0;copy[11]=1;assert(!gallery_init(&g,copy,n));
 memcpy(copy,b,n);copy[16]=0;assert(!gallery_init(&g,copy,n));
 unsigned char bad[]={0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xe0,0x10};
 assert(!gallery_init(&g,bad,sizeof(bad))); assert(!gallery_init(&g,NULL,0));
 unsigned char *max=read_file("tests/output/max-gallery.bin",&n);assert(gallery_init(&g,max,n)&&g.count==255);assert(gallery_page(&g,254,&p));free(max);
 free(copy);free(b);puts("C gallery parser: legacy, v2, truncations and corruption PASS");return 0;
}