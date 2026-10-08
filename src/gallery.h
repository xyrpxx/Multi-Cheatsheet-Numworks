#ifndef GALLERY_H
#define GALLERY_H
#include <stdint.h>
#include <stddef.h>
#define GALLERY_MAX_PAGES 255
typedef struct { const uint8_t *bytes; uint32_t size; uint16_t count; int legacy; } Gallery;
typedef struct { const char *data; uint32_t size, width, height, chunks; } GalleryPage;
/* No payload copies or allocations. All returned spans live with external data. */
int gallery_init(Gallery *gallery, const void *bytes, size_t size);
int gallery_page(const Gallery *gallery, unsigned index, GalleryPage *page);
#endif
