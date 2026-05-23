const mqtt = require('mqtt');
const validate = require('../utils/validators');
const sanitizeInput = require('../utils/sanitizer');
const supabase = require('../config/supabase');
const { checkGeofence } = require('./geofenceService');
const { getSettingSync, onSettingsUpdated } = require('./settingsService');
const logger = require('../utils/logger');

let mqttClient = null;
let currentTopic = null;

function startMqttClient(io) {
    // Note: If Mosquitto runs on the VPS host, the Docker container should connect to the Docker Host IP
    // like mqtt://172.17.0.1:1883 or the VPS Public IP. Define this in your .env file!
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://172.17.0.1:1883';
    
    mqttClient = mqtt.connect(brokerUrl, {
        username: process.env.MQTT_USERNAME || '',
        password: process.env.MQTT_PASSWORD || '',
        reconnectPeriod: 5000,
    });

    mqttClient.on('connect', () => {
        logger.mqtt.connected(brokerUrl);
        
        // Initial subscription
        currentTopic = getSettingSync('MQTT_TOPIC');
        if (currentTopic) {
            mqttClient.subscribe(currentTopic, (err) => {
                if (!err) logger.mqtt.subscribed(currentTopic);
                else logger.mqtt.error(err);
            });
        }
    });

    // Listen for settings changes to update topic dynamically
    onSettingsUpdated((newSettings) => {
        const newTopic = newSettings['MQTT_TOPIC'];
        if (newTopic && newTopic !== currentTopic && mqttClient && mqttClient.connected) {
            if (currentTopic) mqttClient.unsubscribe(currentTopic);
            currentTopic = newTopic;
            mqttClient.subscribe(currentTopic, (err) => {
                if (!err) logger.mqtt.subscribed(currentTopic);
            });
        }
    });

    mqttClient.on('error', (err) => {
        logger.mqtt.error(err);
    });

    mqttClient.on('message', async (topic, msg) => {
        const rawMessage = msg.toString().trim();
        logger.mqtt.raw(topic, rawMessage);

        try {
            let bus_id, latitude, longitude, speed, gas_level, co2, rssi, mqtt_timestamp = null;

            if (rawMessage.startsWith('{')) {
                const data = JSON.parse(rawMessage);
                bus_id = sanitizeInput(data.bus_id || '');
                latitude = parseFloat(data.latitude);
                longitude = parseFloat(data.longitude);
                speed = parseFloat(data.speed);
                gas_level = parseInt(data.gas);
                co2 = parseInt(data.co2) || 0;
                rssi = parseInt(data.rssi) || 0;
                mqtt_timestamp = data.timestamp || data.mqtt_timestamp || data.gps_time || data.time || null;
            } else {
                const parts = rawMessage.split(',');
                if (parts.length < 5) return;

                bus_id = sanitizeInput(parts[0]);
                latitude = parseFloat(parts[1]);
                longitude = parseFloat(parts[2]);
                speed = parseFloat(parts[3]);
                gas_level = parseInt(parts[4]);
                co2 = parts.length > 5 ? parseInt(parts[5]) || 0 : 0;
                rssi = parts.length > 6 ? parseInt(parts[6]) || 0 : 0;
                mqtt_timestamp = parts.length > 7 ? parts[7] : null;
            }

            if (!bus_id || !validate.coordinate(latitude) || !validate.coordinate(longitude)) {
                logger.mqtt.raw(topic, `Validation Failed! bus_id: ${bus_id}, lat: ${latitude}, lng: ${longitude}`);
                return;
            }

            // Parse and validate mqtt_timestamp
            let parsedMqttTimestamp = null;
            if (mqtt_timestamp) {
                const numTs = Number(mqtt_timestamp);
                if (!isNaN(mqtt_timestamp) && numTs > 1000000000000) { // Unix milliseconds
                    parsedMqttTimestamp = new Date(numTs).toISOString();
                } else if (!isNaN(mqtt_timestamp) && numTs > 1000000000) { // Unix seconds
                    parsedMqttTimestamp = new Date(numTs * 1000).toISOString();
                } else {
                    let tsStr = String(mqtt_timestamp).trim();
                    // If it is a string date and doesn't specify any timezone offset (like Z, +07:00, -05:00)
                    if (typeof mqtt_timestamp === 'string' && !tsStr.includes('Z') && !/\+\d{2}:?\d{2}$/.test(tsStr) && !/-\d{2}:?\d{2}$/.test(tsStr)) {
                        let formattedStr = tsStr.replace(' ', 'T');
                        if (!formattedStr.includes('T')) {
                            const d = new Date(tsStr);
                            if (!isNaN(d.getTime())) parsedMqttTimestamp = d.toISOString();
                        } else {
                            const d = new Date(formattedStr + '+07:00'); // Treat as local time WIB (UTC+7)
                            if (!isNaN(d.getTime())) parsedMqttTimestamp = d.toISOString();
                        }
                    } else {
                        const d = new Date(mqtt_timestamp);
                        if (!isNaN(d.getTime())) {
                            parsedMqttTimestamp = d.toISOString();
                        }
                    }
                }
            }

            logger.mqtt.parsed(bus_id, latitude, longitude, speed, gas_level, co2, rssi);

            let cleanSpeed = validate.speed(speed) ? speed : 0;
            const minSpeed = parseFloat(getSettingSync('UDP_MIN_SPEED_THRESHOLD'));
            if (cleanSpeed < minSpeed) cleanSpeed = 0;

            const insertData = {
                bus_id, latitude, longitude,
                speed: cleanSpeed,
                gas_level: validate.gasLevel(gas_level) ? gas_level : 0,
                co2: co2,
                rssi: rssi,
                mqtt_timestamp: parsedMqttTimestamp,
                created_at: new Date().toISOString()
            };

            supabase.from('bipol_tracker').insert([insertData]).select().then(({ data, error }) => {
                if (error) logger.db.error('Insert failed', error);
            });

            checkGeofence(bus_id, latitude, longitude);

            insertData.id = Date.now();

            if (io) {
                io.emit("update_bus", insertData);
            }

        } catch (err) {
            logger.error('MQTT message processing error', { error: err.message });
        }
    });

    return mqttClient;
}

module.exports = { startMqttClient };
