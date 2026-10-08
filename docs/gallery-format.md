# Gallery BIN v2

This project-specific container wraps the historical four-bit grayscale RLE.
All multibyte integers are unsigned little-endian. No C struct is cast onto input.

| Offset | Bytes | Meaning |
|---|---|---|
| 0 | 8 | Signature `MCSHBIN\0` |
| 8 | 2 | Version, exactly 2 |
| 10 | 2 | Page count, 1–255 |
| 12 | 4 | Complete file length |
| 16 | 16 × count | Directory entries in display order |

Each directory entry contains four `uint32` fields: offset from file start,
payload length, pixel width and pixel height. Payloads follow the complete
directory contiguously in directory order; gaps, overlaps and trailing bytes
are rejected. Width is a multiple of 320, from 320 to 3840. Height is a multiple
of 240, from 240 to 2880. The editor exports square tile grids (1–12 tiles per
side), using one shared size/colors/invert setting for all pages.

A payload is the existing byte encoding: the upper nibble plus one is the run
length (1–16), and the lower nibble selects one of 16 grayscale colors. Each
320-pixel horizontal chunk ends exactly at 320 pixels. Chunks are stored left
to right for each row, then top to bottom. The decoded chunk count must equal
`width / 320 × height`. Inversion is applied once before serialization, so the
payload matches the preview.

Without the signature, the runtime reads one legacy RLE page and retains its
existing dimension inference. Truncated runs and unsupported image sizes are
rejected. A matching signature with an invalid version/header is an error,
never a fallback to legacy decoding. A BIN v2 requires the updated NWA.

## Editing and storage

Each page has its own image items, selection and undo/redo history. Sources are
shared by ID. IndexedDB database `MultiCheatsheet`, version 1, object store
`sessions`, key `gallery` contains the version-3 editor state and PNG blobs.
This browser state is independent of the calculator BIN format. Writes are
serialized and transaction completion is awaited. A legacy localStorage draft
at `Cheatsheet:session:v2` is removed only after successful migration. Failed
restore never triggers an automatic overwrite with an empty gallery.

Export requires an image on each page. Removing the last page creates one
empty page. Size advice begins above `2.2 * 1024 * 1024` bytes and does not block
export; successful export does not guarantee available calculator flash space.

## Validation

- `node tests/format-test.cjs`: encoder, page order, legacy bytes, settings and thresholds.
- Build/run `tests/gallery-test.c` with `src/gallery.c`: real parser and corrupt inputs.
- Build `src/main.c` with `SIMULATOR=1` and `main=app_main`, link
  `tests/runtime-test.c` and `src/gallery.c`: actual viewer with scripted EADK.
- `node tests/browser-test.cjs`, with Playwright available: real browser editor,
  IndexedDB migration, reload, save failures and export under a project URL.
  An existing Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
- `make build`: device NWA. `make output/sim/app.dll`: bundled simulator build.
  A newer official simulator can be selected with `SIM_LIB` and
  `SIM_SPLIT_API=1`; use a separate `BUILD_DIR_TEST` when changing simulator ABI.
  Simulator-only `MCS_CAPTURE_PAGE=0` (zero-based) bypasses the periodic table
  for deterministic NWS screenshots; it is absent from the device build.

No physical calculator, phone or USB testing is performed by these checks.
