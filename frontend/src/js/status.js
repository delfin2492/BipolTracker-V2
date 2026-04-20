
const busLastMovedTime = {};
export let GAS_ALERT_THRESHOLD = 600;
export let CO2_ALERT_THRESHOLD = 1000;
let BUS_STOP_TIMEOUT_MINUTES = 5;

export function updateStatusConfig(config) {
    if (config.gasAlertThreshold) GAS_ALERT_THRESHOLD = config.gasAlertThreshold;
    if (config.co2AlertThreshold) CO2_ALERT_THRESHOLD = config.co2AlertThreshold;
    if (config.busStopTimeoutMinutes) BUS_STOP_TIMEOUT_MINUTES = config.busStopTimeoutMinutes;
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
