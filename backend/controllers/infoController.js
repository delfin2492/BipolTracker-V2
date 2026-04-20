const supabase = require('../config/supabase');
const sanitizeInput = require('../utils/sanitizer');
const { getFromCache, setToCache, memoryCache } = require('../utils/cache');
const logger = require('../utils/logger');

exports.getInfo = async (req, res) => {
    try {
        const cached = getFromCache('public_info');
        if (cached) return res.json(cached);

        const { data, error } = await supabase
            .from('app_info')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        setToCache('public_info', data);
        res.json(data);
    } catch (err) {
        logger.error('Get info error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch info' });
    }
};

exports.getConfig = async (req, res) => {
    const { getSetting } = require('../services/settingsService');
    res.json({
        gasAlertThreshold: parseInt(await getSetting('GAS_ALERT_THRESHOLD')),
        co2AlertThreshold: parseInt(await getSetting('CO2_ALERT_THRESHOLD')),
        busStopTimeoutMinutes: parseInt(await getSetting('BUS_STOP_TIMEOUT_MINUTES'))
    });
};

exports.adminGetInfo = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('app_info')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        logger.error('Get admin info error', { error: err.message });
        res.status(500).json({ error: 'Failed to fetch info' });
    }
};

exports.createInfo = async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content required' });
        }

        const { data, error } = await supabase
            .from('app_info')
            .insert([{
                title: sanitizeInput(title).substring(0, 100),
                content: sanitizeInput(content).substring(0, 1000)
            }])
            .select();

        if (error) throw error;
        memoryCache.busData.delete('public_info');

        const io = req.app.get('io');
        if (io) io.emit('update_info');

        res.json({ success: true, data });
    } catch (err) {
        logger.error('Create info error', { error: err.message });
        res.status(500).json({ error: 'Failed to create announcement' });
    }
};

exports.deleteInfo = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('app_info')
            .delete()
            .match({ id });

        if (error) throw error;
        memoryCache.busData.delete('public_info');

        const io = req.app.get('io');
        if (io) io.emit('update_info');

        res.json({ success: true });
    } catch (err) {
        logger.error('Delete info error', { error: err.message });
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
};

exports.getLegacyAnnouncements = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('app_info')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const formattedData = data.map((item, index) => ({
            created_by: "Admin", // Legacy app expects this field
            id: index + 1,       // Legacy app expects Int ID
            message: item.content, // Map content to message
            time: item.created_at
        }));

        res.json({
            data: formattedData,
            message: "Success",
            statusCode: 200
        });
    } catch (err) {
        logger.error('Get legacy announcements error', { error: err.message });
        res.status(500).json({
            data: [],
            message: "Failed to fetch data",
            statusCode: 500
        });
    }
};
