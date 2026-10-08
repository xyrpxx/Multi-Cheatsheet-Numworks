#include "../src/libs/eadk.h"
#include <assert.h>
const char *eadk_external_data;
size_t eadk_external_data_size;
static uint16_t frame[320*240];
static unsigned step, labels, page;
static uint64_t clock_ms, restored_hash;
static const int keys[]={4,3,17,17,-1,17,-1,17,16,-1,16,-1,16,6};
int app_main(void);
static uint64_t hash(void){uint64_t h=1469598103934665603ULL;for(unsigned i=0;i<320*240;i++)h=(h^frame[i])*1099511628211ULL;return h;}
eadk_event_t eadk_event_get(int32_t *timeout){(void)timeout;assert(0);return 0;}
void periodic(void){}
int settings(void){return 0;}
void eadk_display_push_rect(eadk_rect_t r,const eadk_color_t *p){assert(r.x+r.width<=320&&r.y+r.height<=240);for(unsigned y=0;y<r.height;y++)memcpy(frame+(r.y+y)*320+r.x,p+y*r.width,r.width*2);}
void eadk_display_push_rect_uniform(eadk_rect_t r,eadk_color_t c){assert(r.x+r.width<=320&&r.y+r.height<=240);for(unsigned y=0;y<r.height;y++)for(unsigned x=0;x<r.width;x++)frame[(r.y+y)*320+r.x+x]=c;}
void eadk_display_draw_string(const char *s,eadk_point_t p,bool large,eadk_color_t fg,eadk_color_t bg){(void)p;(void)large;(void)fg;(void)bg;if(sscanf(s,"Page %u/",&page)==1)labels++;}
uint64_t eadk_timing_millis(void){return clock_ms;}
void eadk_timing_msleep(uint32_t ms){clock_ms+=ms;}
eadk_keyboard_state_t eadk_keyboard_scan(void){
 assert(step<sizeof(keys)/sizeof(*keys));
 if(step==2)restored_hash=hash();
 if(step==3||step==4)assert(page==2&&labels==2);
 if(step==6||step==8)assert(page==3&&labels==3);
 if(step==9)assert(page==2&&labels==4);
 if(step==11){assert(page==1&&labels==5);assert(hash()==restored_hash);}
 if(step==13)assert(page==1&&labels==5);
 int key=keys[step++];return key<0?0:1ULL<<key;
}
int main(void){FILE*f=fopen("tests/fixtures/gallery.bin","rb");assert(f);fseek(f,0,SEEK_END);eadk_external_data_size=ftell(f);rewind(f);char*b=malloc(eadk_external_data_size);assert(b);assert(fread(b,1,eadk_external_data_size,f)==eadk_external_data_size);fclose(f);eadk_external_data=b;assert(app_main()==0);assert(step==14);free(b);puts("Actual C viewer with scripted EADK: hold, endpoints, zoom/pan restore, clipped drawing PASS");}
