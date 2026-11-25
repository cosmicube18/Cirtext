export const ARDUINO_HEADER_CONTENT = `
#ifndef ARDUINO_H
#define ARDUINO_H

// Fixed-width integer types (freestanding, no stdint.h)
typedef unsigned char uint8_t;
typedef signed char int8_t;
typedef unsigned short uint16_t;
typedef short int16_t;
typedef unsigned int uint32_t;
typedef int int32_t;
typedef unsigned long long uint64_t;
typedef long long int64_t;
typedef unsigned long size_t;
typedef long ssize_t;
typedef long ptrdiff_t;

#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2

#define A0 0
#define A1 1
#define A2 2
#define A3 3
#define A4 4
#define A5 5
#define A6 6
#define A7 7

#define LED_BUILTIN 2

extern "C" {
// Pin modes
void pinMode(uint8_t pin, uint8_t mode) __attribute__((import_module("env"), import_name("js_pin_mode")));

// Digital I/O
void digitalWrite(uint8_t pin, uint8_t val) __attribute__((import_module("env"), import_name("js_digital_write")));
int digitalRead(uint8_t pin) __attribute__((import_module("env"), import_name("js_digital_read")));

// Analog I/O
int analogRead(uint8_t pin) __attribute__((import_module("env"), import_name("js_analog_read")));
void analogWrite(uint8_t pin, int val);

// Tone
void tone(uint8_t pin, unsigned int frequency, unsigned long duration = 0) __attribute__((import_module("env"), import_name("js_ledc_tone")));
void noTone(uint8_t pin) __attribute__((import_module("env"), import_name("js_ledc_tone")));

// LEDC PWM
void ledcSetup(uint8_t channel, uint32_t freq, uint8_t resolution_bits) __attribute__((import_module("env"), import_name("js_ledc_tone")));
void ledcAttachPin(uint8_t pin, uint8_t channel) __attribute__((import_module("env"), import_name("js_ledc_tone")));
void ledcWrite(uint8_t channel, uint32_t duty) __attribute__((import_module("env"), import_name("js_ledc_tone")));
void ledcWriteTone(uint8_t channel, uint32_t freq) __attribute__((import_module("env"), import_name("js_ledc_tone")));

// Time
unsigned long millis(void) __attribute__((import_module("env"), import_name("js_millis")));
unsigned long micros(void) __attribute__((import_module("env"), import_name("js_millis")));
void delay(unsigned long ms) __attribute__((import_module("env"), import_name("js_delay")));
}
void delayMicroseconds(unsigned int us);

// Serial - minimal implementation without <stdio.h>
// Host import: js_serial_print(ptr, len) - prints string from WASM memory
extern "C" void js_serial_print(const char* str, size_t len);

// Internal helper to print a string to host
static inline void serial_write_str(const char* str) {
  if (str) {
    const char* p = str;
    while (*p) p++;
    js_serial_print(str, p - str);
  }
}

// Convert integer to string (no stdio)
static void serial_write_int(long val) {
  char buf[24];
  char* p = buf + 23;
  *p = '\\0';
  bool neg = false;
  if (val < 0) { neg = true; val = -val; }
  do { *--p = char('0' + (val % 10)); val /= 10; } while (val > 0);
  if (neg) *--p = '-';
  serial_write_str(p);
}

static void serial_write_uint(unsigned long val) {
  char buf[24];
  char* p = buf + 23;
  *p = '\\0';
  do { *--p = char('0' + (val % 10)); val /= 10; } while (val > 0);
  serial_write_str(p);
}

static void serial_write_float(double val, int digits) {
  if (val < 0) { serial_write_str("-"); val = -val; }
  long intPart = (long)val;
  serial_write_int(intPart);
  serial_write_str(".");
  double frac = val - intPart;
  for (int i = 0; i < digits; i++) {
    frac *= 10;
    int digit = (int)frac;
    char c = '0' + digit;
    serial_write_str(&c);
    frac -= digit;
  }
}

class Serial_ {
public:
  void begin(unsigned long) { serial_write_str(""); }
  void print(const char* str) { serial_write_str(str); }
  void println(const char* str) { serial_write_str(str); serial_write_str("\\n"); }
  void print(int val) { serial_write_int(val); }
  void println(int val) { serial_write_int(val); serial_write_str("\\n"); }
  void print(unsigned int val) { serial_write_uint(val); }
  void println(unsigned int val) { serial_write_uint(val); serial_write_str("\\n"); }
  void print(long val) { serial_write_int(val); }
  void println(long val) { serial_write_int(val); serial_write_str("\\n"); }
  void print(unsigned long val) { serial_write_uint(val); }
  void println(unsigned long val) { serial_write_uint(val); serial_write_str("\\n"); }
  void print(float val, int digits = 2) { serial_write_float(val, digits); }
  void println(float val, int digits = 2) { serial_write_float(val, digits); serial_write_str("\\n"); }
  void print(double val, int digits = 2) { serial_write_float(val, digits); }
  void println(double val, int digits = 2) { serial_write_float(val, digits); serial_write_str("\\n"); }
};

extern Serial_ Serial;

// Entry points called from host. The Arduino sketch defines setup()/loop() with
// C++ linkage, so declare them here and wrap them in C-linkage trampolines that
// carry explicit Wasm export names. This stops wasm-ld --no-entry from
// stripping or name-mangling the entrypoints the host looks up.
void setup(void);
void loop(void);
extern "C" {
  __attribute__((export_name("wasm_setup"))) void wasm_setup(void) { setup(); }
  __attribute__((export_name("wasm_loop")))  void wasm_loop(void)  { loop(); }
}

#endif
`;