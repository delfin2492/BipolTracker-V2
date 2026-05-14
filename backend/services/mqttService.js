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
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mosquitto:1883';
    
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
            const parts = rawMessage.split(',');
            if (parts.length < 5) return;

            const bus_id = sanitizeInput(parts[0]);
            const latitude = parseFloat(parts[1]);
            const longitude = parseFloat(parts[2]);
            const speed = parseFloat(parts[3]);
            const gas_level = parseInt(parts[4]);
            
            // New metrics (fallback to 0 if not sent to maintain backwards compatibility)
            const co2 = parts.length > 5 ? parseInt(parts[5]) || 0 : 0;
            const rssi = parts.length > 6 ? parseInt(parts[6]) || 0 : 0;

            if (!bus_id || !validate.coordinate(latitude) || !validate.coordinate(longitude)) return;

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
