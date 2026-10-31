#include "Storage.h"
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace Storage {

int getInt(int key, int fallback) {
#ifdef __EMSCRIPTEN__
    return EM_ASM_INT({
        try {
            var value = localStorage.getItem('dash-classic:' + $0);
            if (value === null) return $1;
            var number = parseInt(value, 10);
            return isFinite(number) ? number : $1;
        } catch (error) {
            return $1;
        }
    }, key, fallback);
#else
    (void)key;
    return fallback;
#endif
}

void setInt(int key, int value) {
#ifdef __EMSCRIPTEN__
    EM_ASM({
        try {
            localStorage.setItem('dash-classic:' + $0, String($1));
        } catch (error) {
        }
    }, key, value);
#else
    (void)key;
    (void)value;
#endif
}

}
