
const busLastMovedTime = {};
export let GAS_ALERT_THRESHOLD = 600;
export let CO2_ALERT_THRESHOLD = 1000;
export let CO_LOW_THRESHOLD = 300;
export let CO_MEDIUM_THRESHOLD = 500;
export let CO2_LOW_THRESHOLD = 700;
export let CO2_MEDIUM_THRESHOLD = 900;
let BUS_STOP_TIMEOUT_MINUTES = 5;

export function updateStatusConfig(config) {
    if (config.gasAlertThreshold) GAS_ALERT_THRESHOLD = config.gasAlertThreshold;
    if (config.co2AlertThreshold) CO2_ALERT_THRESHOLD = config.co2AlertThreshold;
    if (config.busStopTimeoutMinutes) BUS_STOP_TIMEOUT_MINUTES = config.busStopTimeoutMinutes;
    if (config.coLowThreshold) CO_LOW_THRESHOLD = config.coLowThreshold;
    if (config.coMediumThreshold) CO_MEDIUM_THRESHOLD = config.coMediumThreshold;
    if (config.co2LowThreshold) CO2_LOW_THRESHOLD = config.co2LowThreshold;
    if (config.co2MediumThreshold) CO2_MEDIUM_THRESHOLD = config.co2MediumThreshold;
}

export function getCOCategory(val) {
    const v = parseFloat(val || 0);
    if (v < CO_LOW_THRESHOLD) return 'Rendah';
    if (v < CO_MEDIUM_THRESHOLD) return 'Sedang';
    return 'Tinggi';
}

export function getCO2Category(val) {
    const v = parseFloat(val || 0);
    if (v < CO2_LOW_THRESHOLD) return 'Rendah';
    if (v < CO2_MEDIUM_THRESHOLD) return 'Sedang';
    return 'Tinggi';
}

export function getBusStatus(bus) {
    const now = Date.now();

    if (bus.speed > 0) {
        busLastMovedTime[bus.bus_id] = now;
        return { status: 'Berjalan', class: 'dot-green', icon: 'fa-bus' };
    }

    if (!busLastMovedTime[bus.bus_id]) {
        return { status: 'Parkir', class: 'dot-gray', icon: 'fa-square-parking' };
    }

    const lastMoved = busLastMovedTime[bus.bus_id];
    const stoppedMinutes = (now - lastMoved) / 1000 / 60;

    if (stoppedMinutes >= BUS_STOP_TIMEOUT_MINUTES) {
        return { status: 'Parkir', class: 'dot-gray', icon: 'fa-square-parking' };
    } else {
        return { status: 'Berhenti', class: 'dot-yellow', icon: 'fa-circle-pause' };
    }
}
