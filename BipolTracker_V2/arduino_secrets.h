/**
 * ARDUINO SECRETS EXAMPLE
 * 
 * Rename this file to "arduino_secrets.h" and fill in your actual data.
 * DO NOT commit the real "arduino_secrets.h" to version control if it contains credentials.
 */

#ifndef ARDUINO_SECRETS_H
#define ARDUINO_SECRETS_H

// GPRS / Cellular Credentials (APN settings depend on your SIM provider)
// Example for Telkomsel: "internet" or "telkomsel"
#define SECRET_APN "internet" 
#define SECRET_GPRS_USER ""
#define SECRET_GPRS_PASS ""

// Backend Server Configuration
// IP Address of your BIPOL VPS (New Server)
// CAUTION: Use the Public IP, not localhost/127.0.0.1
//define SECRET_SERVER_IP "203.0.113.10" // <-- CHANGE THIS
#define SECRET_SERVER_IP "43.134.30.206" // <-- CHANGE THIS

// UDP Port (Must match the port exposed in docker-compose)
// Default: 3333
#define SECRET_UDP_PORT 3333

#endif
