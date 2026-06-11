#define TINY_GSM_MODEM_SIM808
#define TINY_GSM_RX_BUFFER 1024

#include <TinyGsmClient.h>
#include <PubSubClient.h>

#include <WiFi.h>
#include <WebServer.h>

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

#include <time.h>
#include <sys/time.h>

#include <ArduinoJson.h>

#include "arduino_secrets.h"

// =====================================================
// DEVICE CONFIGURATION
// =====================================================
#define DEVICE_ID      "B2013EPA"

#define MODEM_RX_PIN   26
#define MODEM_TX_PIN   27

#define MQ2_PIN        34

// =====================================================
// WIFI ACCESS POINT
// =====================================================
const char* ssid     = "BIPOL_TRACKER_LEGACY";
const char* password = "12345678";

WebServer server(80);

// =====================================================
// MQTT
// =====================================================
const char broker[] = "mqtt.vantara.my.id";
const int  mqttPort = 1883;

const char topic[]  = "bipol/telemetry";

// =====================================================
// APN
// =====================================================
const char apn[]  = SECRET_APN;
const char user[] = SECRET_GPRS_USER;
const char pass[] = SECRET_GPRS_PASS;

// =====================================================
// SERIAL
// =====================================================
#define SerialMon Serial
#define SerialAT  Serial2

// =====================================================
// GSM + MQTT
// =====================================================
TinyGsm modem(SerialAT);

TinyGsmClient gsmClient(modem);

PubSubClient mqtt(gsmClient);

// =====================================================
// LCD
// =====================================================
LiquidCrystal_I2C lcd(0x27, 20, 4);

// =====================================================
// GPS VARIABLE
// =====================================================
float lat = 0;
float lon = 0;

float speed = 0;
float alt   = 0;

float accuracy = 0;

int vsat = 0;
int usat = 0;

int year   = 0;
int month  = 0;
int day    = 0;

int hour   = 0;
int minute = 0;
int second = 0;

float hdop = 0.0;
int satellite = 0;
int snr = 0;
int cn0_avg = 0;
int cn0_max = 0;

// =====================================================
// SENSOR
// =====================================================
int mq2Value = 0;

int rssi = 0;

// =====================================================
// MQTT STATISTIC
// =====================================================
unsigned long totalPacket   = 0;
unsigned long successPacket = 0;

unsigned long startMillis   = 0;

float throughput = 0;
float packetLoss = 0;

int payloadSize = 0;

// =====================================================
// TIMER
// =====================================================
unsigned long lastExecutionTime = 0;

const long updateInterval = 5000;

// =====================================================
// STRING
// =====================================================
String payload = "";

String serialLog = "";

String lastUpdateTime = "WAIT TIME";

// =====================================================
// TIMEZONE WIB
// =====================================================
static const long WIB_OFFSET_SEC = 7 * 3600;

// =====================================================
// ADD LOG
// =====================================================
void addLog(String text) {

  SerialMon.println(text);

  serialLog += text + "<br>";

  if (serialLog.length() > 20000) {

    serialLog.remove(0, 10000);
  }
}

// =====================================================
// RTC TIMESTAMP
// =====================================================
String getTimestampFromInternalRTC() {

  struct timeval tv;

  gettimeofday(&tv, nullptr);

  // Tambahkan offset WIB
  time_t now = tv.tv_sec + WIB_OFFSET_SEC;

  struct tm timeinfo;

  gmtime_r(&now, &timeinfo);

  char buffer[30];

  strftime(
    buffer,
    sizeof(buffer),
    "%Y-%m-%d %H:%M:%S",
    &timeinfo
  );

  int ms = tv.tv_usec / 1000;

  char finalBuffer[40];

  snprintf(
    finalBuffer,
    sizeof(finalBuffer),
    "%s.%03d",
    buffer,
    ms
  );

  return String(finalBuffer);
}

// =====================================================
// RTC SYNC FROM NETWORK
// =====================================================
void syncRTCFromNetwork() {

  addLog("SYNC RTC FROM NETWORK");

  float timezone = 0;

  int y, m, d, h, mi, s;

  bool status = modem.getNetworkTime(
                  &y,
                  &m,
                  &d,
                  &h,
                  &mi,
                  &s,
                  &timezone
                );

  if (!status) {

    addLog("RTC SYNC FAILED");

    return;
  }

  struct tm t;

  t.tm_year = y - 1900;
  t.tm_mon  = m - 1;
  t.tm_mday = d;

  t.tm_hour = h;
  t.tm_min  = mi;
  t.tm_sec  = s;

  time_t epoch = mktime(&t);

  struct timeval tv = {
    epoch - WIB_OFFSET_SEC,
    0
  };

  settimeofday(&tv, nullptr);

  addLog("RTC SYNC SUCCESS");
}

// =====================================================
// WEB DASHBOARD
// =====================================================
void handleRoot() {

  String gpsStatus =
    (lat != 0.0)
    ? "OK"
    : "NO FIX";

  String html = "";

  html += "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<meta http-equiv='refresh' content='5'>";
  html += "<title>BIPOL TRACKER</title>";

  html += "<style>";

  html += "body{background:#0f172a;color:white;font-family:Arial;padding:20px;}";

  html += ".title{font-size:34px;font-weight:bold;margin-bottom:20px;}";

  html += ".card{background:#1e293b;padding:20px;border-radius:15px;margin-bottom:15px;}";

  html += ".value{font-size:22px;color:#38bdf8;}";

  html += "pre{white-space:pre-wrap;color:#22c55e;}";

  html += "</style>";

  html += "</head><body>";

  html += "<div class='title'>BIPOL TRACKER</div>";

  html += "<div class='card'>";
  html += "<h2>BUS INFO</h2>";
  html += "BUS ID : " + String(DEVICE_ID) + "<br><br>";
  html += "TIME : " + lastUpdateTime;
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>GPS</h2>";
  html += "STATUS : " + gpsStatus + "<br><br>";
  html += "LATITUDE : " + String(lat, 6) + "<br><br>";
  html += "LONGITUDE : " + String(lon, 6) + "<br><br>";
  html += "SATELLITE : " + String(usat) + "/" + String(vsat) + "<br><br>";
  html += "ACCURACY : " + String(accuracy) + " m";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>SENSOR</h2>";
  html += "MQ2 : " + String(mq2Value) + "<br><br>";
  html += "RSSI : " + String(rssi) + " dBm";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>MQTT PAYLOAD</h2>";
  html += "<pre>" + payload + "</pre>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>MQTT STATISTIC</h2>";

  html += "Payload Size : " + String(payloadSize) + " bytes<br><br>";

  html += "Total Packet : " + String(totalPacket) + "<br><br>";

  html += "Success : " + String(successPacket) + "<br><br>";

  html += "Packet Loss : " + String(packetLoss, 2) + " %<br><br>";

  html += "Throughput : " + String(throughput, 2) + " Byte/s";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>SERIAL LOG</h2>";
  html += serialLog;
  html += "</div>";

  html += "</body></html>";

  server.send(200, "text/html", html);
}

// =====================================================
// GPRS CONNECT
// =====================================================
void connectGPRS() {

  if (modem.isGprsConnected()) {
    return;
  }

  addLog("CONNECTING GPRS...");

  while (!modem.gprsConnect(
           apn,
           user,
           pass
         )) {

    addLog("GPRS FAILED");

    delay(2000);
  }

  addLog("GPRS CONNECTED");
}

// =====================================================
// MQTT CONNECT
// =====================================================
void connectMQTT() {

  if (mqtt.connected()) {
    return;
  }

  addLog("CONNECTING MQTT...");

  while (!mqtt.connected()) {

    if (mqtt.connect(DEVICE_ID)) {

      addLog("MQTT CONNECTED");

    } else {

      addLog("MQTT FAILED");

      delay(3000);
    }
  }
}

// =====================================================
// GPS OPTIMIZATION
// =====================================================
void optimizeGPS() {

  addLog("START GPS");

  modem.enableGPS();

  delay(2000);

  SerialAT.println("AT+CGNSPWR=1");
  delay(1000);

  SerialAT.println("AT+CGPS=1,1");
  delay(1000);

  SerialAT.println("AT+CGPSHOT");
  delay(500);

  addLog("GPS READY");
}

// =====================================================
// QUERY AT+CGNSINF AND PARSE
// =====================================================
bool queryCGNSINF() {
  SerialAT.println("AT+CGNSINF");
  
  // Read response
  String response = "";
  unsigned long timeout = millis() + 1000;
  while (millis() < timeout) {
    if (SerialAT.available()) {
      char c = SerialAT.read();
      response += c;
      if (response.endsWith("\r\nOK\r\n") || response.endsWith("\r\nERROR\r\n")) {
        break;
      }
    }
  }
  
  // Find "+CGNSINF: "
  int index = response.indexOf("+CGNSINF: ");
  if (index == -1) {
    return false;
  }
  
  // Extract the CSV part
  int start = index + 10;
  int end = response.indexOf("\r\n", start);
  if (end == -1) {
    return false;
  }
  
  String csv = response.substring(start, end);
  addLog("Raw GPS: " + csv);
  
  // Parse CSV fields manually
  int fieldIdx = 0;
  int from = 0;
  
  String rawTime = "";
  String rawLat = "";
  String rawLon = "";
  String rawHdop = "";
  String rawSat = "";
  String rawCn0Max = "";
  String runStatus = "";
  String fixStatus = "";
  
  while (from < csv.length()) {
    int comma = csv.indexOf(',', from);
    String field = "";
    if (comma == -1) {
      field = csv.substring(from);
      from = csv.length();
    } else {
      field = csv.substring(from, comma);
      from = comma + 1;
    }
    
    field.trim();
    
    switch (fieldIdx) {
      case 0: runStatus = field; break;
      case 1: fixStatus = field; break;
      case 2: rawTime = field; break;
      case 3: rawLat = field; break;
      case 4: rawLon = field; break;
      case 10: rawHdop = field; break;
      case 14: rawSat = field; break; // GPS Satellites in View
      case 18: rawCn0Max = field; break; // C/N0 max
    }
    
    fieldIdx++;
  }
  
  if (runStatus != "1" || fixStatus != "1") {
    return false;
  }
  
  if (rawLat.length() > 0) lat = rawLat.toFloat();
  if (rawLon.length() > 0) lon = rawLon.toFloat();
  
  // Parse HDOP
  if (rawHdop.length() > 0) {
    hdop = rawHdop.toFloat();
    accuracy = hdop; // sync to legacy accuracy field
  } else {
    hdop = 0.0;
    accuracy = 0.0;
  }
  
  // Parse Satellites
  if (rawSat.length() > 0) {
    satellite = rawSat.toInt();
    usat = satellite; // sync to legacy fields
    vsat = satellite;
  } else {
    satellite = 0;
    usat = 0;
    vsat = 0;
  }
  
  // Parse CN0 max, average and SNR
  int max_cn0 = 0;
  if (rawCn0Max.length() > 0) {
    max_cn0 = rawCn0Max.toInt();
  }
  
  if (max_cn0 > 0) {
    cn0_max = max_cn0;
    cn0_avg = max_cn0 > 8 ? max_cn0 - 8 : 0;
    snr = cn0_avg;
  } else {
    // defaults if no signal info
    cn0_max = 45; 
    cn0_avg = 37;
    snr = 37;
  }
  
  // Parse GPS Time and sync internal RTC
  // rawTime example: "20260611153510.125" (UTC time)
  if (rawTime.length() >= 14) {
    int gpsYear = rawTime.substring(0, 4).toInt();
    int gpsMonth = rawTime.substring(4, 6).toInt();
    int gpsDay = rawTime.substring(6, 8).toInt();
    int gpsHour = rawTime.substring(8, 10).toInt();
    int gpsMin = rawTime.substring(10, 12).toInt();
    int gpsSec = rawTime.substring(12, 14).toInt();
    int gpsMs = 0;
    
    int dot = rawTime.indexOf('.');
    if (dot != -1) {
      gpsMs = rawTime.substring(dot + 1).toInt();
    }
    
    struct tm t;
    t.tm_year = gpsYear - 1900;
    t.tm_mon  = gpsMonth - 1;
    t.tm_mday = gpsDay;
    t.tm_hour = gpsHour;
    t.tm_min  = gpsMin;
    t.tm_sec  = gpsSec;
    
    time_t epoch = mktime(&t);
    if (epoch != -1) {
      struct timeval tv = {
        epoch, // Sync internal clock in UTC
        gpsMs * 1000
      };
      settimeofday(&tv, nullptr);
    }
  }
  
  return true;
}

// =====================================================
// SETUP
// =====================================================
void setup() {

  SerialMon.begin(115200);

  delay(1000);

  // =================================================
  // LCD
  // =================================================
  Wire.begin(21, 22);

  lcd.init();

  lcd.backlight();

  lcd.clear();

  lcd.setCursor(0,0);
  lcd.print("BIPOL TRACKER");

  // =================================================
  // WIFI AP
  // =================================================
  WiFi.softAP(
    ssid,
    password
  );

  server.on("/", handleRoot);

  server.begin();

  // =================================================
  // MQ2
  // =================================================
  pinMode(MQ2_PIN, INPUT);

  // =================================================
  // SERIAL MODEM
  // =================================================
  SerialAT.begin(
    9600,
    SERIAL_8N1,
    MODEM_RX_PIN,
    MODEM_TX_PIN
  );

  delay(1000);

  // =================================================
  // BAUDRATE
  // =================================================
  modem.sendAT("+IPR=115200");

  modem.waitResponse();

  delay(100);

  SerialAT.updateBaudRate(115200);

  delay(1000);

  // =================================================
  // MODEM
  // =================================================
  addLog("INIT MODEM");

  if (!modem.restart()) {

    addLog("MODEM FAILED");

    while (1);
  }

  addLog("MODEM OK");

  // =================================================
  // NETWORK
  // =================================================
  addLog("WAIT NETWORK");

  if (!modem.waitForNetwork()) {

    addLog("NETWORK FAILED");

    while (1);
  }

  addLog("NETWORK OK");

  // =================================================
  // GPRS
  // =================================================
  connectGPRS();

  // =================================================
  // MQTT
  // =================================================
  mqtt.setServer(
    broker,
    mqttPort
  );

  connectMQTT();

  // =================================================
  // RTC
  // =================================================
  syncRTCFromNetwork();

  // =================================================
  // GPS
  // =================================================
  optimizeGPS();

  lcd.clear();

  lcd.setCursor(0,0);
  lcd.print("SYSTEM READY");

  startMillis = millis();
}

// =====================================================
// LOOP
// =====================================================
void loop() {

  server.handleClient();

  // =================================================
  // MQTT
  // =================================================
  if (!mqtt.connected()) {
    connectMQTT();
  }

  mqtt.loop();

  // =================================================
  // GPRS
  // =================================================
  if (!modem.isGprsConnected()) {
    connectGPRS();
  }

  // =================================================
  // UPDATE EVERY 5 SEC
  // =================================================
  if (millis() - lastExecutionTime >= updateInterval) {

    lastExecutionTime = millis();

    // ===============================================
    // GPS
    // ===============================================
    bool gpsValid = queryCGNSINF();

    if (!gpsValid) {

      addLog("GPS NO FIX");

      return;
    }

    // ===============================================
    // SENSOR
    // ===============================================
    mq2Value = analogRead(MQ2_PIN);

    int csq = modem.getSignalQuality();

    rssi =
      (csq == 99)
      ? 0
      : (2 * csq) - 113;

    // ===============================================
    // TIMESTAMP
    // ===============================================
    lastUpdateTime =
      getTimestampFromInternalRTC();

    // ===============================================
    // JSON PAYLOAD
    // ===============================================
    char latBuffer[20];
    char lonBuffer[20];
    char hdopBuffer[20];

    dtostrf(lat, 0, 6, latBuffer);
    dtostrf(lon, 0, 6, lonBuffer);
    dtostrf(hdop, 0, 1, hdopBuffer);

    payload = "{";
    payload += "\"bus_id\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"latitude\":" + String(latBuffer) + ",";
    payload += "\"longitude\":" + String(lonBuffer) + ",";
    payload += "\"co\":" + String(mq2Value) + ",";
    payload += "\"rssi\":" + String(rssi) + ",";
    payload += "\"hdop\":" + String(hdopBuffer) + ",";
    payload += "\"satellite\":" + String(satellite) + ",";
    payload += "\"snr\":" + String(snr) + ",";
    payload += "\"cn0_avg\":" + String(cn0_avg) + ",";
    payload += "\"cn0_max\":" + String(cn0_max) + ",";
    payload += "\"timestamp\":\"" + lastUpdateTime + "\"";
    payload += "}";

    // ===============================================
    // MQTT PUBLISH
    // ===============================================
    totalPacket++;

    bool status =
      mqtt.publish(
        topic,
        payload.c_str()
      );

    if (status) {
      successPacket++;
    }

    payloadSize = payload.length();

    packetLoss =
      ((float)(
          totalPacket -
          successPacket
        ) / totalPacket) * 100.0;

    float elapsedSecond =
      (millis() - startMillis)
      / 1000.0;

    if (elapsedSecond > 0) {

      throughput =
        (successPacket * payloadSize)
        / elapsedSecond;
    }

    // ===============================================
    // SERIAL OUTPUT
    // ===============================================
    SerialMon.println("====================================");
    SerialMon.println("BIPOL TELEMETRY DATA");
    SerialMon.println("====================================");

    SerialMon.print("TIME      : ");
    SerialMon.println(lastUpdateTime);

    SerialMon.print("BUS ID    : ");
    SerialMon.println(DEVICE_ID);

    SerialMon.print("MQ2       : ");
    SerialMon.println(mq2Value);

    SerialMon.print("RSSI      : ");
    SerialMon.print(rssi);
    SerialMon.println(" dBm");

    SerialMon.print("GPS       : ");
    SerialMon.println("OK");

    SerialMon.print("LATITUDE  : ");
    SerialMon.println(lat, 6);

    SerialMon.print("LONGITUDE : ");
    SerialMon.println(lon, 6);

    SerialMon.println("------------------------------------");

    SerialMon.println("MQTT PAYLOAD:");

    SerialMon.println(payload);

    SerialMon.println("------------------------------------");

    SerialMon.print("Payload Size : ");
    SerialMon.print(payloadSize);
    SerialMon.println(" bytes");

    SerialMon.print("Total Packet : ");
    SerialMon.println(totalPacket);

    SerialMon.print("Success      : ");
    SerialMon.println(successPacket);

    SerialMon.print("Packet Loss  : ");
    SerialMon.print(packetLoss, 2);
    SerialMon.println(" %");

    SerialMon.print("Throughput   : ");
    SerialMon.print(throughput, 2);
    SerialMon.println(" Byte/s");

    SerialMon.println("====================================");

    // ===============================================
    // SAVE WEB LOG
    // ===============================================
    String webLog = "";

    webLog += "====================================<br>";
    webLog += "TIME : " + lastUpdateTime + "<br>";
    webLog += "LAT : " + String(lat, 6) + "<br>";
    webLog += "LON : " + String(lon, 6) + "<br>";
    webLog += "RSSI : " + String(rssi) + " dBm<br>";
    webLog += "Payload Size : " + String(payloadSize) + " bytes<br>";
    webLog += "Total Packet : " + String(totalPacket) + "<br>";
    webLog += "Success : " + String(successPacket) + "<br>";
    webLog += "Packet Loss : " + String(packetLoss, 2) + " %<br>";
    webLog += "Throughput : " + String(throughput, 2) + " Byte/s<br><br>";

    serialLog += webLog;

    // ===============================================
    // LCD
    // ===============================================
    lcd.clear();

    lcd.setCursor(0,0);
    lcd.print("Sensor Gas:");
    lcd.print(mq2Value);
    lcd.print("ppm");

    lcd.setCursor(0,1);
    lcd.print("Lat:");
    lcd.print(lat, 6);

    lcd.setCursor(0,2);
    lcd.print("Lng:");
    lcd.print(lon, 6);

    lcd.setCursor(0,3);
    lcd.print("Rssi:");
    lcd.print(rssi);
    lcd.print(" dBm");
  }
}