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

// =====================================================================
// I2C (Wire) + LiquidCrystal_I2C + Sensor simulation bridge
// ---------------------------------------------------------------------
// All bus traffic is answered by the host, which only ACKs devices that are
// actually powered (VCC on a live rail + GND grounded) and wired to the ESP32
// I2C pins (GPIO21 SDA / GPIO22 SCL). Miswired devices NACK and read as 0.
// =====================================================================
extern "C" {
void js_i2c_begin_transmission(uint8_t addr) __attribute__((import_module("env"), import_name("js_i2c_begin_transmission")));
void js_i2c_write(uint8_t data) __attribute__((import_module("env"), import_name("js_i2c_write")));
int  js_i2c_end_transmission(void) __attribute__((import_module("env"), import_name("js_i2c_end_transmission")));
int  js_i2c_request_from(uint8_t addr, int len) __attribute__((import_module("env"), import_name("js_i2c_request_from")));
int  js_i2c_read(void) __attribute__((import_module("env"), import_name("js_i2c_read")));
int  js_i2c_available(void) __attribute__((import_module("env"), import_name("js_i2c_available")));
int  js_i2c_device_online(uint8_t addr) __attribute__((import_module("env"), import_name("js_i2c_device_online")));
double js_sensor_value(uint8_t addr, uint8_t metric) __attribute__((import_module("env"), import_name("js_sensor_value")));
void js_lcd_init(uint8_t addr) __attribute__((import_module("env"), import_name("js_lcd_init")));
void js_lcd_clear(uint8_t addr) __attribute__((import_module("env"), import_name("js_lcd_clear")));
void js_lcd_set_cursor(uint8_t addr, uint8_t col, uint8_t row) __attribute__((import_module("env"), import_name("js_lcd_set_cursor")));
void js_lcd_print(uint8_t addr, const char* str, size_t len) __attribute__((import_module("env"), import_name("js_lcd_print")));
void js_lcd_backlight(uint8_t addr, uint8_t on) __attribute__((import_module("env"), import_name("js_lcd_backlight")));
}

#define I2C_SDA 21
#define I2C_SCL 22

class TwoWire {
public:
  void begin() {}
  void begin(int sda, int scl) { (void)sda; (void)scl; }
  void begin(int sda, int scl, uint32_t frequency) { (void)sda; (void)scl; (void)frequency; }
  void setClock(uint32_t frequency) { (void)frequency; }

  void beginTransmission(uint8_t address) { js_i2c_begin_transmission(address); }
  void beginTransmission(int address) { js_i2c_begin_transmission((uint8_t)address); }

  size_t write(uint8_t data) { js_i2c_write(data); return 1; }
  size_t write(const uint8_t* data, size_t len) {
    for (size_t i = 0; i < len; i++) js_i2c_write(data[i]);
    return len;
  }

  uint8_t endTransmission(void) { return (uint8_t)js_i2c_end_transmission(); }
  uint8_t endTransmission(uint8_t sendStop) { (void)sendStop; return (uint8_t)js_i2c_end_transmission(); }

  uint8_t requestFrom(int address, int len) { return (uint8_t)js_i2c_request_from((uint8_t)address, len); }
  uint8_t requestFrom(int address, int len, int stop) { (void)stop; return (uint8_t)js_i2c_request_from((uint8_t)address, len); }

  int available(void) { return js_i2c_available(); }
  int read(void) { return js_i2c_read(); }
};

TwoWire Wire;

// ---------------------------------------------------------------
// LiquidCrystal_I2C (16x2). Text is buffered on the host per address.
// ---------------------------------------------------------------
static void lcd_emit_int(uint8_t addr, long val) {
  char tmp[24];
  int t = 0;
  bool neg = false;
  if (val < 0) { neg = true; val = -val; }
  do { tmp[t++] = char('0' + (val % 10)); val /= 10; } while (val > 0);
  if (neg) tmp[t++] = '-';
  char out[24];
  int n = 0;
  for (int i = t - 1; i >= 0; i--) out[n++] = tmp[i];
  js_lcd_print(addr, out, (size_t)n);
}

static void lcd_emit_float(uint8_t addr, double val, int digits) {
  if (val < 0) { char m = '-'; js_lcd_print(addr, &m, 1); val = -val; }
  long intPart = (long)val;
  lcd_emit_int(addr, intPart);
  char dot = '.';
  js_lcd_print(addr, &dot, 1);
  double frac = val - (double)intPart;
  for (int i = 0; i < digits; i++) {
    frac *= 10;
    int d = (int)frac;
    char c = char('0' + d);
    js_lcd_print(addr, &c, 1);
    frac -= d;
  }
}

class LiquidCrystal_I2C {
  uint8_t _addr;
public:
  LiquidCrystal_I2C(uint8_t address, uint8_t cols, uint8_t rows) : _addr(address) { (void)cols; (void)rows; }

  void init() { js_lcd_init(_addr); }
  void init(uint8_t, uint8_t) { js_lcd_init(_addr); }
  void begin() { js_lcd_init(_addr); }
  void begin(uint8_t, uint8_t) { js_lcd_init(_addr); }

  void backlight() { js_lcd_backlight(_addr, 1); }
  void noBacklight() { js_lcd_backlight(_addr, 0); }
  void setBacklight(uint8_t on) { js_lcd_backlight(_addr, on ? 1 : 0); }

  void clear() { js_lcd_clear(_addr); }
  void home() { js_lcd_clear(_addr); }
  void setCursor(uint8_t col, uint8_t row) { js_lcd_set_cursor(_addr, col, row); }

  void print(const char* str) {
    if (!str) return;
    const char* p = str;
    while (*p) p++;
    js_lcd_print(_addr, str, (size_t)(p - str));
  }
  void print(char c) { js_lcd_print(_addr, &c, 1); }
  void print(int val) { lcd_emit_int(_addr, (long)val); }
  void print(long val) { lcd_emit_int(_addr, val); }
  void print(unsigned int val) { lcd_emit_int(_addr, (long)val); }
  void print(unsigned long val) { lcd_emit_int(_addr, (long)val); }
  void print(float val) { lcd_emit_float(_addr, (double)val, 2); }
  void print(double val) { lcd_emit_float(_addr, val, 2); }
  void print(float val, int digits) { lcd_emit_float(_addr, (double)val, digits); }
  void print(double val, int digits) { lcd_emit_float(_addr, val, digits); }

  void println() {}
  void println(const char* str) { print(str); }
  void println(int val) { print(val); }
  void createChar(uint8_t, uint8_t*) {}
};

// ---------------------------------------------------------------
// I2C sensor helpers. All return 0 / error when the device is offline.
// metric: 0 = temperature, 1 = humidity, 2 = light lux, 3 = CO2 ppm
// ---------------------------------------------------------------
class SHT31 {
  uint8_t _addr;
public:
  SHT31() : _addr(0x44) {}
  bool begin(uint8_t address = 0x44) { _addr = address; return js_i2c_device_online(_addr) != 0; }
  float readTemperature() { return (float)js_sensor_value(_addr, 0); }
  float readHumidity() { return (float)js_sensor_value(_addr, 1); }
  uint16_t readStatus() { return js_i2c_device_online(_addr) ? 0 : 0xFFFF; }
};
typedef SHT31 Adafruit_SHT31;

class BH1750 {
  uint8_t _addr;
public:
  enum Mode {
    CONTINUOUS_HIGH_RES_MODE = 0x10,
    CONTINUOUS_HIGH_RES_MODE_2 = 0x11,
    CONTINUOUS_LOW_RES_MODE = 0x13,
    ONE_TIME_HIGH_RES_MODE = 0x20,
    ONE_TIME_LOW_RES_MODE = 0x23
  };
  BH1750(uint8_t address = 0x23) : _addr(address) {}
  bool begin() { return js_i2c_device_online(_addr) != 0; }
  bool begin(uint8_t mode) { (void)mode; return js_i2c_device_online(_addr) != 0; }
  bool begin(uint8_t address, uint8_t mode) { _addr = address; (void)mode; return js_i2c_device_online(_addr) != 0; }
  float readLightLevel() { return (float)js_sensor_value(_addr, 2); }
};
typedef BH1750 Adafruit_BH1750;

class SensirionI2CScd4x {
  uint8_t _addr;
public:
  SensirionI2CScd4x() : _addr(0x62) {}
  void begin(TwoWire& wire) { (void)wire; }
  void begin() {}
  uint16_t startPeriodicMeasurement() { return js_i2c_device_online(_addr) ? 0 : 1; }
  uint16_t stopPeriodicMeasurement() { return 0; }
  uint16_t readMeasurement(uint16_t& co2, float& temperature, float& humidity) {
    if (!js_i2c_device_online(_addr)) {
      co2 = 0;
      temperature = 0.0f;
      humidity = 0.0f;
      return 1;
    }
    co2 = (uint16_t)js_sensor_value(_addr, 3);
    temperature = (float)js_sensor_value(_addr, 0);
    humidity = (float)js_sensor_value(_addr, 1);
    return 0;
  }
};
typedef SensirionI2CScd4x SCD4x;

#endif
`;