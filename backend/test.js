const xss = require('xss');

function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return xss(str.trim().substring(0, 1000));
}

const validate = {
    coordinate: (value) => {
        const num = parseFloat(value);
        return !isNaN(num) && num >= -180 && num <= 180;
    }
}

const rawMessage = '{"bus_id":"SIM-UI-01","latitude":-6.364699179869703,"longitude":106.82169679550077,"speed":45,"gas":197,"co2":495,"rssi":-62}';

let bus_id, latitude, longitude, speed, gas_level, co2, rssi;

if (rawMessage.startsWith('{')) {
    const data = JSON.parse(rawMessage);
    bus_id = sanitizeInput(data.bus_id || '');
    latitude = parseFloat(data.latitude);
    longitude = parseFloat(data.longitude);
    speed = parseFloat(data.speed);
    gas_level = parseInt(data.gas);
    co2 = parseInt(data.co2) || 0;
    rssi = parseInt(data.rssi) || 0;
}

console.log("Parsed:", {bus_id, latitude, longitude, speed, gas_level, co2, rssi});

if (!bus_id || !validate.coordinate(latitude) || !validate.coordinate(longitude)) {
    console.log("Failed validation!");
} else {
    console.log("Success validation!");
}
