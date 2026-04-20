const dgram = require('dgram');
const validate = require('../utils/validators');
const sanitizeInput = require('../utils/sanitizer');
const supabase = require('../config/supabase');
const { checkGeofence } = require('./geofenceService');
const { getSettingSync } = require('./settingsService');
const logger = require('../utils/logger');

const UDP_PORT = process.env.UDP_PORT || 3333;

function startUdpServer(io) {
    const udpServer = dgram.createSocket('udp4');

    udpServer.on('error', (err) => {
        logger.udp.error(err);
        udpServer.close();
    });

    udpServer.on('message', async (msg, rinfo) => {
        const rawMessage = msg.toString().trim();
        logger.udp.raw(rinfo.address, rinfo.port, rawMessage);

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

            logger.udp.parsed(bus_id, latitude, longitude, speed, gas_level, co2, rssi);

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
            logger.error('UDP message processing error', { error: err.message });
        }
    });

    udpServer.bind(UDP_PORT, () => {
        logger.udp.listening(UDP_PORT);
    });

    return udpServer;
}

module.exports = { startUdpServer };

