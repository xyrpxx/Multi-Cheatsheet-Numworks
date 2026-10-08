#include "gallery.h"
#include <string.h>
static const uint8_t magic[8] = {'M','C','S','H','B','I','N',0};
static uint16_t le16(const uint8_t *p) { return p[0] | (uint16_t)p[1] << 8; }
static uint32_t le32(const uint8_t *p) { return p[0] | (uint32_t)p[1]<<8 | (uint32_t)p[2]<<16 | (uint32_t)p[3]<<24; }
static int validate_rle(const uint8_t *p, uint32_t size, uint32_t *chunks) {
    uint32_t pixels = 0, lines = 0;
    for (uint32_t i = 0; i < size; ++i) {
        pixels += (p[i] >> 4) + 1;
        if (pixels > 320) return 0;
        if (pixels == 320) { ++lines; pixels = 0; }
    }
    *chunks = lines;
    return !pixels && lines && lines <= 12U * 2880U;
}
int gallery_page(const Gallery *g, unsigned index, GalleryPage *p) {
    if (!g || !p || index >= g->count) return 0;
    memset(p, 0, sizeof(*p));
    if (g->legacy) { p->data = (const char *)g->bytes; p->size = g->size; }
    else {
        const uint8_t *e = g->bytes + 16 + index * 16;
        uint32_t offset = le32(e);
        p->size = le32(e + 4); p->width = le32(e + 8); p->height = le32(e + 12);
        if (offset > g->size || p->size > g->size - offset) return 0;
        p->data = (const char *)g->bytes + offset;
    }
    return validate_rle((const uint8_t *)p->data, p->size, &p->chunks);
}
int gallery_init(Gallery *g, const void *bytes, size_t size) {
    if (!g) return 0;
    memset(g, 0, sizeof(*g));
    if (!bytes || !size || size > UINT32_MAX) return 0;
    g->bytes = bytes; g->size = (uint32_t)size;
    if (size < 8 || memcmp(bytes, magic, 8)) {
        GalleryPage p;
        g->count = 1; g->legacy = 1;
        if (gallery_page(g, 0, &p) && p.chunks % 240 == 0) return 1;
        goto invalid;
    }
    if (size < 16 || le16(g->bytes + 8) != 2 || le32(g->bytes + 12) != size) goto invalid;
    g->count = le16(g->bytes + 10);
    if (!g->count || g->count > GALLERY_MAX_PAGES) goto invalid;
    uint32_t next = 16 + g->count * 16;
    if (next > size) goto invalid;
    for (unsigned i = 0; i < g->count; ++i) {
        const uint8_t *e = g->bytes + 16 + i * 16;
        GalleryPage p;
        if (le32(e) != next || !gallery_page(g, i, &p)) goto invalid;
        if (!p.width || p.width > 3840 || p.width % 320 || !p.height || p.height > 2880 || p.height % 240) goto invalid;
        if (p.chunks != p.width / 320 * p.height) goto invalid;
        next += p.size; /* page bounds above prove this addition cannot overflow */
    }
    if (next != size) goto invalid;
    return 1;
invalid:
    memset(g, 0, sizeof(*g));
    return 0;
}
