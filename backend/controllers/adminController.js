const supabase = require('../config/supabase');
const { getFromCache, setToCache } = require('../utils/cache');
const sanitizeInput = require('../utils/sanitizer');
const validate = require('../utils/validators');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getAllSettings, updateSettings } = require('../services/settingsService');
const logger = require('../utils/logger');

exports.getLogs = async (req, res) => {
    try {
        const cached = getFromCache('admin_logs');
        if (cached) return res.json(cached);

        const { data, error } = await supabase
            .from('bipol_tracker')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        setToCache('admin_logs', data);
        res.json(data);
    } catch (err) {
        logger.error('Get logs error:', err.message);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

exports.getDrivers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('id, bus_plate, driver_name, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        logger.error('Get drivers error:', err.message);
        res.status(500).json({ error: 'Failed to fetch drivers' });
    }
};

exports.createDriver = async (req, res) => {
    try {
        const { bus_plate, driver_name, password } = req.body;

        let formattedPlate = bus_plate.toUpperCase().replace(/\s/g, '');
        const plateRegex = /^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/;
        const match = formattedPlate.match(plateRegex);

        if (match) {
            formattedPlate = `${match[1]} ${match[2]} ${match[3]}`.trim();
        } else {
            formattedPlate = bus_plate.trim();
        }

        if (!validate.busPlate(formattedPlate)) {
            return res.status(400).json({ error: 'Invalid bus plate format' });
        }

        let finalPassword = password;
        if (!finalPassword) {
            finalPassword = crypto.randomBytes(4).toString('hex');
        }

        const hash = await bcrypt.hash(finalPassword, 12);

        const { data, error } = await supabase
            .from('drivers')
            .insert([{
                bus_plate: sanitizeInput(formattedPlate),
                driver_name: sanitizeInput(driver_name) || null,
                password_hash: hash
            }])
            .select();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Bus plate already exists' });
            throw error;
        }

        res.json({ success: true, data: data[0], generatedPassword: finalPassword });
    } catch (err) {
        logger.error('Create driver error:', err.message);
        res.status(500).json({ error: 'Failed to add driver' });
    }
};

exports.deleteDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        logger.error('Delete driver error:', err.message);
        res.status(500).json({ error: 'Failed to delete driver' });
    }
};

exports.resetDriverPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const rawPassword = crypto.randomBytes(4).toString('hex');
        const hash = await bcrypt.hash(rawPassword, 12);

        const { error } = await supabase
            .from('drivers')
            .update({ password_hash: hash })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true, newPassword: rawPassword });
    } catch (err) {
        logger.error('Reset driver password error:', err.message);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

exports.updateDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { bus_plate, driver_name, password } = req.body;

        const updates = {};
        if (bus_plate) {
            let formattedPlate = bus_plate.toUpperCase().replace(/\s/g, '');
            const plateRegex = /^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/;
            const match = formattedPlate.match(plateRegex);
            if (match) {
                formattedPlate = `${match[1]} ${match[2]} ${match[3]}`.trim();
            }
            updates.bus_plate = sanitizeInput(formattedPlate);
        }
        if (driver_name !== undefined) updates.driver_name = sanitizeInput(driver_name);

        if (password && password.trim() !== "") {
            updates.password_hash = await bcrypt.hash(password, 12);
        }

        const { error } = await supabase
            .from('drivers')
            .update(updates)
            .eq('id', id);

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Bus plate already exists' });
            throw error;
        }

        res.json({ success: true });
    } catch (err) {
        logger.error('Update driver error:', err.message);
        res.status(500).json({ error: 'Failed to update driver' });
    }
};

exports.getGeofenceEvents = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('geofence_events')
            .select(`*, geofences ( name )`)
            .order('timestamp', { ascending: false })
            .limit(50);

        if (error) throw error;

        const formatted = data.map(e => ({
            ...e,
            zone_name: e.geofences ? e.geofences.name : 'Unknown'
        }));

        res.json(formatted);
    } catch (err) {
        logger.error('Get geofence events error:', err.message);
        res.status(500).json({ error: 'Failed to fetch geofence events' });
    }
};

exports.getSettings = async (req, res) => {
    try {
        const settings = await getAllSettings();
        res.json(settings);
    } catch (err) {
        logger.error('Get settings error:', err.message);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { gasThreshold, co2Threshold, stopTimeout, minSpeed } = req.body;
        const updates = {};

        if (gasThreshold !== undefined) updates['GAS_ALERT_THRESHOLD'] = gasThreshold;
        if (co2Threshold !== undefined) updates['CO2_ALERT_THRESHOLD'] = co2Threshold;
        if (stopTimeout !== undefined) updates['BUS_STOP_TIMEOUT_MINUTES'] = stopTimeout;
        if (minSpeed !== undefined) updates['UDP_MIN_SPEED_THRESHOLD'] = minSpeed;

        await updateSettings(updates);
        res.json({ success: true });
    } catch (err) {
        logger.error('Update settings error:', err.message);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};
