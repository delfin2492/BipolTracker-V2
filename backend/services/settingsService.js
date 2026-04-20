const supabase = require('../config/supabase');
const logger = require('../utils/logger');

let settingsCache = {};
let lastFetch = 0;
const CACHE_TTL = 60 * 1000;

const DEFAULTS = {
    GAS_ALERT_THRESHOLD: '600',
    CO2_ALERT_THRESHOLD: '1000',
    BUS_STOP_TIMEOUT_MINUTES: '5',
    UDP_MIN_SPEED_THRESHOLD: '3.0'
};

async function loadSettings() {
    try {
        const { data, error } = await supabase.from('app_settings').select('*');
        if (error) {
            logger.error('Failed to load settings from DB', { error: error.message });
            if (Object.keys(settingsCache).length === 0) {
                settingsCache = { ...DEFAULTS };
            }
            return;
        }

        const newCache = {};
        data.forEach(item => {
            newCache[item.key] = item.value;
        });

        for (const [key, val] of Object.entries(DEFAULTS)) {
            if (newCache[key] === undefined) {
                newCache[key] = val;
            }
        }

        settingsCache = newCache;
        lastFetch = Date.now();
        logger.settings.loaded(settingsCache);
    } catch (err) {
        logger.error('Settings load error', { error: err.message });
    }
}

loadSettings();

async function getSetting(key) {
    if (Date.now() - lastFetch > CACHE_TTL) {
        await loadSettings();
    }
    return settingsCache[key] !== undefined ? settingsCache[key] : DEFAULTS[key];
}

function getSettingSync(key) {
    return settingsCache[key] !== undefined ? settingsCache[key] : DEFAULTS[key];
}

async function getAllSettings() {
    if (Date.now() - lastFetch > CACHE_TTL) {
        await loadSettings();
    }
    return settingsCache;
}

async function updateSettings(updates) {
    try {
        const upserts = Object.entries(updates).map(([key, value]) => ({
            key,
            value: String(value),
            updated_at: new Date()
        }));

        const { data, error } = await supabase
            .from('app_settings')
            .upsert(upserts)
            .select();

        if (error) throw error;

        upserts.forEach(u => {
            settingsCache[u.key] = u.value;
        });

        return data;
    } catch (err) {
        logger.error('Update settings error', { error: err.message });
        throw err;
    }
}

module.exports = {
    loadSettings,
    getSetting,
    getSettingSync,
    getAllSettings,
    updateSettings
};

