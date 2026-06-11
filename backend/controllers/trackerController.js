const supabase = require('../config/supabase');
const sanitizeInput = require('../utils/sanitizer');
const validate = require('../utils/validators');
const { setToCache } = require('../utils/cache');
const { checkGeofence } = require('../services/geofenceService');
const logger = require('../utils/logger');

exports.trackBus = async (req, res) => {
    try {
        const bus_id = sanitizeInput(req.body.bus_id);
        const latitude = parseFloat(req.body.latitude);
        const longitude = parseFloat(req.body.longitude);
        const speed = parseFloat(req.body.speed) || 0;
        const gas_level = parseInt(req.body.gas !== undefined ? req.body.gas : (req.body.co !== undefined ? req.body.co : req.body.gas_level)) || 0;
        const co2 = req.body.co2 !== undefined ? parseInt(req.body.co2) : 0;
        const rssi = req.body.rssi !== undefined ? parseInt(req.body.rssi) : 0;
        const hdop = req.body.hdop !== undefined ? parseFloat(req.body.hdop) : null;
        const snr = req.body.snr !== undefined ? parseFloat(req.body.snr) : null;
        const satellite = req.body.satellite !== undefined ? parseInt(req.body.satellite) : null;
        const cn0_avg = req.body.cn0_avg !== undefined ? parseInt(req.body.cn0_avg) : null;
        const cn0_max = req.body.cn0_max !== undefined ? parseInt(req.body.cn0_max) : null;

        if (!bus_id || !validate.coordinate(latitude) || !validate.coordinate(longitude)) {
            return res.status(400).send("Data invalid");
        }

        const mqtt_timestamp = req.body.timestamp || req.body.mqtt_timestamp || null;
        let parsedMqttTimestamp = null;
        if (mqtt_timestamp) {
            const numTs = Number(mqtt_timestamp);
            if (!isNaN(mqtt_timestamp) && numTs > 1000000000000) {
                parsedMqttTimestamp = new Date(numTs).toISOString();
            } else if (!isNaN(mqtt_timestamp) && numTs > 1000000000) {
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

        const insertData = {
            bus_id,
            latitude,
            longitude,
            speed: validate.speed(speed) ? speed : 0,
            gas_level: validate.gasLevel(gas_level) ? gas_level : 0,
            co2,
            rssi,
            hdop,
            snr,
            satellite,
            cn0_avg,
            cn0_max,
            mqtt_timestamp: parsedMqttTimestamp,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('bipol_tracker')
            .insert([insertData])
            .select();

        if (error) throw error;

        setToCache(`bus_${bus_id}`, data[0]);
        checkGeofence(bus_id, latitude, longitude);

        const io = req.app.get('io');
        if (io) io.emit("update_bus", data[0]);

        res.status(200).send("OK");
    } catch (err) {
        logger.error('Track error', { error: err.message });
        res.status(500).send("Error");
    }
};

exports.getLocations = async (req, res) => {
    try {
        // Step 1: Scan for active bus IDs (lightweight query)
        const { data: idList, error: scanError } = await supabase
            .from('bipol_tracker')
            .select('bus_id')
            .order('created_at', { ascending: false })
            .limit(20000); // Increased limit to 20k to catch sleeping buses

        if (scanError) throw scanError;

        let uniqueBusIds = [...new Set(idList.map(item => item.bus_id))];

        // DYNAMIC FLEET DISCOVERY: Fetch all registered buses from 'drivers' table
        const { data: fleetData, error: fleetError } = await supabase
            .from('drivers')
            .select('bus_plate');

        if (!fleetError && fleetData) {
            const knownFleet = fleetData.map(d => d.bus_plate);

            // Check for missing buses
            const missingBuses = knownFleet.filter(id => !uniqueBusIds.includes(id));
            if (missingBuses.length > 0) {
                // console.log(`⚠️ Force checking missing buses from Fleet: ${missingBuses.join(', ')}`);
                uniqueBusIds = [...uniqueBusIds, ...missingBuses];
            }
        }

        // Step 2: Fetch latest details for each unique bus
        const promises = uniqueBusIds.map(async (id) => {
            const { data, error } = await supabase
                .from('bipol_tracker')
                .select('*')
                .eq('bus_id', id)
                .neq('latitude', 0) // Filter invalid GPS
                .order('created_at', { ascending: false })
                .limit(1);

            if (error || !data || data.length === 0) return null;
            return data[0];
        });

        const results = await Promise.all(promises);
        const buses = results.filter(b => b !== null);

        const isLegacyMobile = req.headers['authorization'] === 'cff2f609d3accf61df924590eac88bc2e5107eb3df47af97576f3ab6139e59bc';

        res.json({
            data: buses.map((bus, index) => {
                if (isLegacyMobile) {
                    return {
                        ...bus,
                        id: index + 1, // Unique Int ID for each bus
                        timestamp: bus.created_at
                    };
                }
                return bus;
            })
        });
    } catch (err) {
        logger.error('Get bus location error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
};

exports.getBusPlates = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('bus_plate')
            .order('bus_plate', { ascending: true });

        if (error) throw error;
        res.json(data.map(d => d.bus_plate));
    } catch (err) {
        logger.error('Get bus plates error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch bus list' });
    }
};

exports.getBusLogs = async (req, res) => {
    try {
        const { bus_id } = req.params;
        const limit = parseInt(req.query.limit) || 30;

        const { data, error } = await supabase
            .from('bipol_tracker')
            .select('*')
            .eq('bus_id', bus_id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        
        // Reverse so that the oldest is first, which is standard for left-to-right charts
        res.json({ data: data.reverse() });
    } catch (err) {
        logger.error('Get bus logs error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch bus logs' });
    }
};