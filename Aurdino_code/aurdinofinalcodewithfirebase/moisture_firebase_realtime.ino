#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "time.h"
#include "moisture_types.h"

// Firebase credentials (from firebase_credential.txt + Web API Key.docx)
#define API_KEY "AIzaSyBIFybKR45Z8sG3qRjQozmyke6xRChCW1k"
#define DATABASE_URL "https://smart-agriculture-9827-default-rtdb.firebaseio.com/"
#define USER_EMAIL "esp32@gmail.com"
#define USER_PASSWORD "smart_esp32"

// Fallback WiFi (auto-connect to saved first)
#define WIFI_SSID "realmeC51"
#define WIFI_PASSWORD "87654321"

//It is an internet protocol used to synchronize the clocks of computers, servers,
// and network devices (like routers and switches) to a precise, standardized time source. 
// NTP time
#define NTP_SERVER_1 "pool.ntp.org"
#define NTP_SERVER_2 "time.nist.gov"
#define GMT_OFFSET_SEC 0
#define DAYLIGHT_OFFSET_SEC 0

// Pin mapping (from existing sketches)
const int SENSOR_PIN = 32;  // moisture sensor AO
const int RED_PIN = 27;     // red LED + buzzer driver (shared)
const int GREEN_PIN = 26;
const int YELLOW_PIN = 33;
const int RELAY_PIN = 14;   // pump relay IN

// Moisture thresholds (raw ADC 0..4095)
const int YELLOW_THRESHOLD = 3600; // raw >= 3600 -> yellow
const int RED_THRESHOLD = 2500;    // 2500..3599 -> red
// raw < 2500 -> green

// Relay modules are often active-low
const bool RELAY_ACTIVE_LOW = true; // set false if relay is active-high
const int RELAY_ON = RELAY_ACTIVE_LOW ? LOW : HIGH;
const int RELAY_OFF = RELAY_ACTIVE_LOW ? HIGH : LOW;

// Upload interval
const unsigned long UPLOAD_INTERVAL_MS = 1000;

FirebaseData fbdo; //Creates an object to send requests  to firebase Receives responses from Firebase 
FirebaseAuth auth;           // used for firebase authentication 
FirebaseConfig config;

unsigned long lastUploadMs = 0;

// ============== WiFi Connection Tracking ==============
unsigned long wifiStartTime = 0;  // When we started trying to connect

void WiFiEvent(WiFiEvent_t event) {
  Serial.printf("[WiFi] Event: %d\n", event);
}

void printElapsedTime() {
  unsigned long elapsed = millis() - wifiStartTime;
  unsigned long seconds = elapsed / 1000;
  unsigned long minutes = seconds / 60;
  seconds = seconds % 60;
  
  Serial.print("[WiFi] Elapsed: ");
  if (minutes > 0) {
    Serial.print(minutes);
    Serial.print("m ");
  }
  Serial.print(seconds);
  Serial.print("s | Status: ");
  Serial.print(WiFi.status());
  Serial.print(" | RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
}

// Try to connect using pattern from original working code
// Returns true if connected, false otherwise
bool tryConnectWiFiOnce() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

  // First try: Use ESP32's auto-saved credentials (from last successful connection)
  Serial.println("[WiFi] Trying auto-connect (saved credentials)...");
  WiFi.begin();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    printElapsedTime();
    delay(1000);
  }

  // If auto-connect failed, try with explicit credentials
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Auto-connect failed, trying explicit credentials...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
      printElapsedTime();
      delay(1000);
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    unsigned long totalTime = millis() - wifiStartTime;
    Serial.println();
    Serial.println("========================================");
    Serial.print("[WiFi] SUCCESS! Connected in ");
    Serial.print(totalTime);
    Serial.println("ms");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("========================================");
    return true;
  } else {
    Serial.println("[WiFi] Connection attempt FAILED");
    return false;
  }
}

// Keep trying forever until connected - records elapsed time
void waitForWiFi() {
  // Record start time for tracking total connection time
  wifiStartTime = millis();
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("[WiFi] Starting connection attempts");
  Serial.println("[WiFi] Will keep trying forever until connected");
  Serial.println("========================================");
  
  WiFi.onEvent(WiFiEvent);
  
  int attemptCount = 0;
  
  while (WiFi.status() != WL_CONNECTED) {
    attemptCount++;
    Serial.println();
    Serial.print("[WiFi] ====== Attempt ");
    Serial.print(attemptCount);
    Serial.println(" ======");
    
    if (tryConnectWiFiOnce()) {
      return;  // Connected!
    }
    
    // Wait 5 seconds before next attempt (same as original working code)
    Serial.println("[WiFi] Waiting 5 seconds before retry...");
    delay(5000);
  }
}

void initTime() {
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER_1, NTP_SERVER_2);
}

void allLedsOff() {
  digitalWrite(RED_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);
  digitalWrite(YELLOW_PIN, LOW);
}

void initHardware() {
  analogReadResolution(12);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);

  allLedsOff();
  digitalWrite(RELAY_PIN, RELAY_OFF);
}

void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

bool getIsoTime(String &outIso, unsigned long &outEpoch) {
  time_t now = time(nullptr);
  outEpoch = (unsigned long)now;
  if (now < 1609459200) { // before 2021-01-01 -> not synced
    outIso = "";
    return false;
  }
  struct tm timeinfo;
  if (!localtime_r(&now, &timeinfo)) {
    outIso = "";
    return false;
  }
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  outIso = String(buf);
  return true;
}

const char* stateToString(MoistureState s) {
  switch (s) {
    case STATE_GREEN: return "GREEN";
    case STATE_RED: return "RED";
    case STATE_YELLOW: return "YELLOW";
    default: return "UNKNOWN";
  }
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("========================================");
  Serial.println("   Moisture Monitor - ESP32");
  Serial.println("   Firebase Realtime Edition");
  Serial.println("========================================");

  // Block until WiFi is connected; do not run other logic before this.
  waitForWiFi();

  initHardware();
  initTime();
  initFirebase();
  
  Serial.println();
  Serial.println("[Setup] Initialization complete!");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    waitForWiFi();
    return;
  }

  int raw = analogRead(SENSOR_PIN);
  MoistureState state;

  if (raw >= YELLOW_THRESHOLD) {
    state = STATE_YELLOW;
  } else if (raw >= RED_THRESHOLD) {
    state = STATE_RED;
  } else {
    state = STATE_GREEN;
  }

  allLedsOff();
  bool pumpOn = false;

  if (state == STATE_RED) {
    digitalWrite(RED_PIN, HIGH); // red LED + buzzer
    digitalWrite(RELAY_PIN, RELAY_ON);
    pumpOn = true;
  } else if (state == STATE_GREEN) {
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(RELAY_PIN, RELAY_OFF);
  } else {
    digitalWrite(YELLOW_PIN, HIGH);
    digitalWrite(RELAY_PIN, RELAY_OFF);
  }

  Serial.print("Raw=");
  Serial.print(raw);
  Serial.print(" State=");
  Serial.print(stateToString(state));
  Serial.print(" Pump=");
  Serial.println(pumpOn ? "ON" : "OFF");

  unsigned long nowMs = millis();
  if (Firebase.ready() && nowMs - lastUploadMs >= UPLOAD_INTERVAL_MS) {
    lastUploadMs = nowMs;

    String iso;
    unsigned long epoch = 0;
    bool timeValid = getIsoTime(iso, epoch);

    if (!timeValid) {
      Serial.println("Time not synced yet; skipping Firebase upload.");
    } else {
      String path = String("/moisture_readings/") + String(epoch);

      FirebaseJson json;
      json.set("raw", raw);
      json.set("status", stateToString(state));
      json.set("pump_on", pumpOn);
      json.set("ts_epoch", (long)epoch);
      json.set("ts_iso", iso);
      json.set("ts_ms", (long)nowMs);
      json.set("time_valid", true);

      if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
        Serial.println("Firebase OK");
      } else {
        Serial.print("Firebase FAILED: ");
        Serial.println(fbdo.errorReason());
      }
    }
  }

  delay(500);
}
