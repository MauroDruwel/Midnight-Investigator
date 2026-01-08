#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>

// ---------- HARDWARE CONFIG ----------
#define LED_PIN    5
#define NUM_LEDS   30
#define BRIGHTNESS 60

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

// ---------- STATE MACHINE ----------
enum AnimMode {
  MODE_STILL,
  MODE_PULSE,
  MODE_SPINNER,
  MODE_RAINBOW,
  MODE_SPARKLE
};

AnimMode currentMode = MODE_PULSE;
uint8_t targetR = 0, targetG = 255, targetB = 150; // Midnight Emerald
float currentR = 0, currentG = 255, currentB = 150; // Current displayed color
float currentLevel = 1.0;
bool ascending = false;
int spinnerPos = 0;

// ---------- WIFI CONFIG ----------
const char* ssid     = "Reaktor-gast";
const char* password = "welcome@reaktor";

WebServer server(80);

// ---------- COLOR UTILS ----------
uint32_t dimColor(uint8_t r, uint8_t g, uint8_t b, float factor) {
  return strip.Color((uint8_t)(r * factor), (uint8_t)(g * factor), (uint8_t)(b * factor));
}

// ---------- ANIMATIONS (NON-BLOCKING) ----------

void animStill() {
  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.Color((uint8_t)currentR, (uint8_t)currentG, (uint8_t)currentB));
  }
}

void animPulse() {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 20) return;
  lastUpdate = millis();

  if (ascending) {
    currentLevel += 0.015;
    if (currentLevel >= 1.0) { currentLevel = 1.0; ascending = false; }
  } else {
    currentLevel -= 0.015;
    if (currentLevel <= 0.2) { currentLevel = 0.2; ascending = true; }
  }

  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, dimColor((uint8_t)currentR, (uint8_t)currentG, (uint8_t)currentB, currentLevel));
  }
}

void animSpinner() {
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 15) return;
  lastUpdate = millis();

  spinnerPos = (spinnerPos + 1) % NUM_LEDS;

  strip.clear();
  // Drawing a comet tail
  for (int i = 0; i < 20; i++) {
    int p = (spinnerPos - i + NUM_LEDS) % NUM_LEDS;
    float fade = 1.0 - (i / 20.0);
    // Spinner always uses target color for immediate feedback or we can use current for fade transition too.
    // Let's use current for consistency, or target if we want it to 'snap' to the new mode color.
    // User asked for "fade animation", so let's stick to current.
    strip.setPixelColor(p, dimColor((uint8_t)currentR, (uint8_t)currentG, (uint8_t)currentB, fade * fade));
  }
}

void animRainbow() {
  static uint16_t j = 0;
  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 20) return;
  lastUpdate = millis();

  for (int i = 0; i < NUM_LEDS; i++) {
    strip.setPixelColor(i, strip.gamma32(strip.ColorHSV((i * 65536 / NUM_LEDS) + j)));
  }
  j += 256;
}

// Fade helper
void fadeTowardsTarget() {
  // Simple proportional feedback for smooth easing
  float ease = 0.1; 
  currentR += (targetR - currentR) * ease;
  currentG += (targetG - currentG) * ease;
  currentB += (targetB - currentB) * ease;
}

void updateAnimation() {
  fadeTowardsTarget();
  switch (currentMode) {
    case MODE_STILL:   animStill();   break;
    case MODE_PULSE:   animPulse();   break;
    case MODE_SPINNER: animSpinner(); break;
    case MODE_RAINBOW: animRainbow(); break;
  }
  strip.show();
}

// ---------- HTTP HANDLERS ----------

void handleSet() {
  // Params: r, g, b, mode (0=still, 1=pulse, 2=spinner, 3=rainbow)
  if (server.hasArg("r")) targetR = server.arg("r").toInt();
  if (server.hasArg("g")) targetG = server.arg("g").toInt();
  if (server.hasArg("b")) targetB = server.arg("b").toInt();
  if (server.hasArg("mode")) {
    int m = server.arg("mode").toInt();
    currentMode = (AnimMode)constrain(m, 0, 3);
  }

  String resp = "State Updated: Mode=" + String(currentMode) + 
                " RGB=" + String(targetR) + "," + String(targetG) + "," + String(targetB);
  server.send(200, "text/plain", resp);
  Serial.println(resp);
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.show();

  // Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected. IP: " + WiFi.localIP().toString());

  server.on("/set", HTTP_GET, handleSet);
  server.on("/", []() {
    server.send(200, "text/plain", "Midnight Investigator Hardware Node Active.");
  });
  
  server.begin();
}

void loop() {
  server.handleClient();
  updateAnimation();
}