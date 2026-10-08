/* Optional adapter for the split-return ABI in newer official simulators.
 * Mirrors epsilon/eadk/include/eadk/eadk.h, without changing the device ABI. */
#if SIMULATOR_SPLIT_API
#include "../src/libs/eadk.h"
void _eadk_keyboard_scan_do_scan(void);
uint32_t _eadk_keyboard_scan_low(void), _eadk_keyboard_scan_high(void);
uint32_t _eadk_timing_millis_low(void), _eadk_timing_millis_high(void);
eadk_keyboard_state_t eadk_keyboard_scan(void) {
    _eadk_keyboard_scan_do_scan();
    return (uint64_t)_eadk_keyboard_scan_high() << 32 | _eadk_keyboard_scan_low();
}
uint64_t eadk_timing_millis(void) {
    return (uint64_t)_eadk_timing_millis_high() << 32 | _eadk_timing_millis_low();
}
#endif
