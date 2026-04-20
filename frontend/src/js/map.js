import { stops, rutePagi, ruteSore, bounds } from './data.js';
import { calculateDistance, estimateArrival, formatTime } from './utils.js';
import { getBusStatus, GAS_ALERT_THRESHOLD, CO2_ALERT_THRESHOLD } from './status.js';

let map;
let busMarkers = {};
let stopMarkers = [];
let followBusId = null;

export function getMapPadding() {
    const width = window.innerWidth;
    const isMobileLandscape = window.matchMedia("(orientation: landscape) and (max-height: 600px)").matches;
    const isDesktop = width >= 768;

    if (isMobileLandscape) {
        return { top: 20, bottom: 20, left: 340, right: 90 };
    }
    if (isDesktop) {
        return { top: 40, bottom: 130, left: 40, right: 40 };
    }
    return { top: 40, bottom: 230, left: 20, right: 20 };
}

export function getMap() {
    return map;
}

export function setFollowBusId(id) {
    followBusId = id;
}

export function getFollowBusId() {
    return followBusId;
}

export function closeAllPopups() {
    Object.values(busMarkers).forEach(obj => {
        const popup = obj.marker.getPopup();
        if (popup) popup.remove();
    });
}

export function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: {
            'version': 8,
            'glyphs': 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
            'sources': {
                'google-maps': {
                    'type': 'raster',
                    'tiles': [
                        `https://mt0.google.com/vt/lyrs=m${(window.devicePixelRatio > 1) ? '&scale=2' : ''}&hl=id&x={x}&y={y}&z={z}`,
                        `https://mt1.google.com/vt/lyrs=m${(window.devicePixelRatio > 1) ? '&scale=2' : ''}&hl=id&x={x}&y={y}&z={z}`,
                        `https://mt2.google.com/vt/lyrs=m${(window.devicePixelRatio > 1) ? '&scale=2' : ''}&hl=id&x={x}&y={y}&z={z}`,
                        `https://mt3.google.com/vt/lyrs=m${(window.devicePixelRatio > 1) ? '&scale=2' : ''}&hl=id&x={x}&y={y}&z={z}`
                    ],
                    'tileSize': 256,
                    'attribution': '&copy; Google Maps'
                }
            },
            'layers': [
                {
                    'id': 'google-maps-layer',
                    'type': 'raster',
                    'source': 'google-maps',
                    'minzoom': 0,
                    'maxzoom': 22
                }
            ]
        },
        bounds: bounds,
        maxBounds: [
            [bounds.getSouthWest().lng - 0.05, bounds.getSouthWest().lat - 0.05],
            [bounds.getNorthEast().lng + 0.05, bounds.getNorthEast().lat + 0.05]
        ],
        fitBoundsOptions: { padding: getMapPadding() },
        padding: getMapPadding(),
        pitch: 0,
        bearing: 0,
        antialias: true,
        maxZoom: 18,
        minZoom: 9
    });

    map.on('load', () => {
        loadMapImages(map);
        setTimeout(() => {
            map.resize();
            map.fitBounds(bounds, { padding: getMapPadding(), animate: false });
        }, 500);
    });

    window.addEventListener('resize', () => {
        if (map) {
            const newPadding = getMapPadding();
            map.setPadding(newPadding);
        }
    });

    map.on('styleimagemissing', (e) => {
        const id = e.id;
        if (!map.hasImage(id)) {
            const pixel = new Uint8Array(4);
            pixel[0] = 0; pixel[1] = 0; pixel[2] = 0; pixel[3] = 0;
            map.addImage(id, { width: 1, height: 1, data: pixel });
        }
    });

    map.on('error', (e) => {
        if (e.error && e.error.message && e.error.message.includes('Expected value to be of type number, but found null')) {
            return;
        }
        console.warn('Map error:', e.error);
    });

    return map;
}

export function addRoutes() {
    if (!map.getSource('rutePagi')) {
        map.addSource('rutePagi', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: rutePagi } } });

        map.addLayer({
            id: 'rutePagiLayer', type: 'line', source: 'rutePagi',
            layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'visible' },
            paint: {
                'line-color': '#BF1E2E',
                'line-width': 6,
                'line-opacity': 0.8,
                'line-offset': -3
            }
        });

        map.addLayer({
            id: 'rutePagiArrows', type: 'symbol', source: 'rutePagi',
            layout: {
                'icon-image': 'arrow',
                'symbol-placement': 'line',
                'symbol-spacing': 50,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': 0.6,
                'icon-offset': [0, -4],
                'visibility': 'visible',
                'icon-rotation-alignment': 'map'
            },
            paint: { 'icon-opacity': 0.9, 'icon-color': '#ffffff' }
        });
    }

    if (!map.getSource('ruteSore')) {
        map.addSource('ruteSore', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: ruteSore } } });

        map.addLayer({
            id: 'ruteSoreLayer', type: 'line', source: 'ruteSore',
            layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'visible' },
            paint: {
                'line-color': '#159BB3',
                'line-width': 6,
                'line-opacity': 0.8,
                'line-offset': 3
            }
        });

        map.addLayer({
            id: 'ruteSoreArrows', type: 'symbol', source: 'ruteSore',
            layout: {
                'icon-image': 'arrow',
                'symbol-placement': 'line',
                'symbol-spacing': 50,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': 0.6,
                'icon-offset': [0, 4],
                'visibility': 'visible',
                'icon-rotation-alignment': 'map'
            },
            paint: { 'icon-opacity': 0.9, 'icon-color': '#ffffff' }
        });
    }
    document.querySelectorAll('.chip').forEach(el => el.classList.add('active-route'));
}

function loadMapImages(map) {
    const arrowCanvas = document.createElement('canvas');
    arrowCanvas.width = 24;
    arrowCanvas.height = 24;
    const ctxArrow = arrowCanvas.getContext('2d');

    ctxArrow.beginPath();
    ctxArrow.moveTo(6, 4);
    ctxArrow.lineTo(16, 12);
    ctxArrow.lineTo(6, 20);
    ctxArrow.lineWidth = 4;
    ctxArrow.strokeStyle = '#ffffff';
    ctxArrow.lineCap = 'round';
    ctxArrow.lineJoin = 'round';
    ctxArrow.stroke();

    map.addImage('arrow', {
        width: 24,
        height: 24,
        data: ctxArrow.getImageData(0, 0, 24, 24).data
    });

    const stopCanvas = document.createElement('canvas');
    stopCanvas.width = 32;
    stopCanvas.height = 32;
    const ctxStop = stopCanvas.getContext('2d');

    ctxStop.beginPath();
    ctxStop.arc(16, 16, 13, 0, Math.PI * 2);
    ctxStop.fillStyle = '#ffffff';
    ctxStop.fill();
    ctxStop.lineWidth = 3;
    ctxStop.strokeStyle = '#0f172a';
    ctxStop.stroke();

    ctxStop.fillStyle = '#0f172a';
    ctxStop.beginPath();
    ctxStop.roundRect(9, 9, 14, 14, 2);
    ctxStop.fill();

    ctxStop.fillStyle = '#ffffff';
    ctxStop.fillRect(11, 11, 10, 5);

    ctxStop.fillStyle = '#0f172a';
    ctxStop.beginPath();
    ctxStop.arc(11, 24, 1.5, 0, Math.PI * 2);
    ctxStop.arc(21, 24, 1.5, 0, Math.PI * 2);
    ctxStop.fill();

    map.addImage('stop-icon', {
        width: 32,
        height: 32,
        data: ctxStop.getImageData(0, 0, 32, 32).data
    });
}

export function toggleRoute(layerIdObj, element) {
    if (!map) return;
    const layerId = layerIdObj + 'Layer';
    const visibility = map.getLayoutProperty(layerId, 'visibility');
    const newVisibility = (visibility === 'visible' || visibility === undefined) ? 'none' : 'visible';
    map.setLayoutProperty(layerId, 'visibility', newVisibility);

    const arrowLayerId = layerId.replace('Layer', 'Arrows');
    if (map.getLayer(arrowLayerId)) {
        map.setLayoutProperty(arrowLayerId, 'visibility', newVisibility);
    }

    const isVisible = newVisibility === 'visible';
    if (element) {
        if (element.classList.contains('chip') || element.classList.contains('chip-dashboard')) {
            element.classList.toggle('active-route', isVisible);
        }
        if (element.classList.contains('route-card-item')) {
            element.classList.toggle('active-card', isVisible);
        }
        if (!element.classList.contains('chip-dashboard')) {
            const icon = element.querySelector('i');
            if (icon) {
                icon.className = isVisible ? 'fa-solid fa-check' : 'fa-solid fa-xmark';
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.toggleRoute = toggleRoute;
}

export function addStops() {
    stopMarkers.forEach(m => m.remove());
    stopMarkers = [];

    const stopsGeoJSON = {
        type: 'FeatureCollection',
        features: stops.map(stop => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
            properties: { title: stop.title.replace('Halte ', ''), fullName: stop.title }
        }))
    };

    if (map.getSource('stopsSource')) {
        map.getSource('stopsSource').setData(stopsGeoJSON);
    } else {
        map.addSource('stopsSource', { type: 'geojson', data: stopsGeoJSON });

        map.addLayer({
            id: 'stopsIcons',
            type: 'symbol',
            source: 'stopsSource',
            layout: {
                'icon-image': 'stop-icon',
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            }
        });

        map.addLayer({
            id: 'stopsLabels',
            type: 'symbol',
            source: 'stopsSource',
            minzoom: 14.5,
            layout: {
                'text-field': ['get', 'title'],
                'text-font': ['Open Sans Bold'],
                'text-size': 12,
                'text-offset': [0, 2],
                'text-anchor': 'top',
                'text-allow-overlap': false
            },
            paint: {
                'text-color': '#334155',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2
            }
        });

        const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });

        map.on('mouseenter', 'stopsIcons', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = e.features[0].properties.fullName;
            popup.setLngLat(coordinates).setText(description).addTo(map);
        });

        map.on('mouseleave', 'stopsIcons', () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });

        map.on('click', 'stopsIcons', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            map.flyTo({ center: coordinates, zoom: 16 });
        });
    }
}

export function add3DBuildings() {
    const style = map.getStyle();
    if (!style || !style.sources) return;
    const vectorSource = Object.keys(style.sources).find(key => style.sources[key].type === 'vector');
    if (vectorSource && !map.getLayer('add-3d-buildings')) {
        map.addLayer({
            'id': 'add-3d-buildings',
            'source': vectorSource,
            'source-layer': 'building',
            'filter': ['all',
                ['has', 'extrude'],
                ['==', ['get', 'extrude'], 'true']
            ],
            'type': 'fill-extrusion',
            'minzoom': 14,
            'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                    'case',
                    ['has', 'render_height'], ['to-number', ['get', 'render_height'], 0],
                    ['has', 'height'], ['to-number', ['get', 'height'], 0],
                    0
                ],
                'fill-extrusion-base': [
                    'case',
                    ['has', 'render_min_height'], ['to-number', ['get', 'render_min_height'], 0],
                    ['has', 'min_height'], ['to-number', ['get', 'min_height'], 0],
                    0
                ],
                'fill-extrusion-opacity': 0.6
            }
        });
    }
}

export function updateMarker(bus) {
    const targetPos = [bus.longitude, bus.latitude];
    const gasClass = bus.gas_level > GAS_ALERT_THRESHOLD ? 'popup-danger' : '';

    const busStatus = getBusStatus(bus);
    const statusText = busStatus.status;

    let statusClass = 'status-stopped';
    if (statusText === 'Berjalan') statusClass = 'status-moving';
    else if (statusText === 'Berhenti') statusClass = 'status-paused';

    let etaHtml = '';
    let sortStops = stops.map(stop => {
        return {
            ...stop,
            dist: calculateDistance(bus.latitude, bus.longitude, stop.lat, stop.lng)
        };
    }).sort((a, b) => a.dist - b.dist);

    const nearest = sortStops[0];
    if (nearest && nearest.dist < 5) {
        const timeMin = estimateArrival(nearest.dist, bus.speed);
        etaHtml = `
        <div class="popup-eta" style="margin-top:10px; padding-top:10px; border-top:1px solid #eee;">
            <div style="font-size:0.75rem; color:#6b7280; display:flex; justify-content:space-between; align-items:center;">
                <span>Menuju <b>${nearest.title.replace('Halte ', '')}</b></span>
                <span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700;">${formatTime(timeMin)}</span>
            </div>
            <div style="width:100%; height:4px; background:#f3f4f6; border-radius:2px; margin-top:6px; overflow:hidden;">
                <div style="width:${Math.max(10, Math.min(100, (1 - nearest.dist / 3) * 100))}%; height:100%; background:#0369a1; border-radius:2px;"></div>
            </div>
        </div>`;

        checkAndShowArrivalNotification(bus, nearest);
    }

    const gasClass = bus.gas_level > GAS_ALERT_THRESHOLD ? 'popup-danger' : '';
    const co2Class = (bus.co2 !== undefined && bus.co2 > CO2_ALERT_THRESHOLD) ? 'popup-danger' : '';

    const content = `
        <div class="bus-popup">
            <div class="popup-header">
                <img src="./images/bipol.png" class="popup-icon">
                <div class="popup-title">
                    <h3>${bus.bus_id}</h3>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <span class="popup-status ${statusClass}" style="font-size:0.7rem; padding:2px 6px;">${statusText}</span>
                    </div>
                </div>
            </div>
            <div class="popup-stats" style="display: grid; grid-template-columns: 1fr 1fr; row-gap: 8px; column-gap: 6px;">
                <div class="popup-stat">
                    <i class="fa-solid fa-gauge"></i>
                    <span>${bus.speed} km/h</span>
                </div>
                <div class="popup-stat ${gasClass}">
                    <i class="fa-solid fa-fire"></i>
                    <span>${bus.gas_level}</span>
                </div>
                <div class="popup-stat ${co2Class}">
                    <i class="fa-solid fa-cloud"></i>
                    <span>${bus.co2 !== undefined ? bus.co2 : 0} PPM</span>
                </div>
                <div class="popup-stat">
                    <i class="fa-solid fa-wifi"></i>
                    <span>${bus.rssi !== undefined ? bus.rssi : 0} dBm</span>
                </div>
            </div>
            ${etaHtml}
        </div>
    `;

    if (busMarkers[bus.bus_id]) {
        const markerObj = busMarkers[bus.bus_id];
        markerObj.marker.setLngLat(targetPos);
        markerObj.marker.getPopup().setHTML(content);
        if (getFollowBusId() === bus.bus_id && getMap()) {
            const map = getMap();
            const maxBounds = map.getMaxBounds();
            if (!maxBounds || maxBounds.contains(targetPos)) {
                map.jumpTo({ center: targetPos });
            }
        }
    } else {
        const el = document.createElement('div');
        el.className = 'bus-marker-icon';
        el.style.backgroundImage = 'url(/images/bipol.png)';
        el.style.width = '42px';
        el.style.height = '42px';
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.cursor = 'pointer';

        const pulse = document.createElement('div');
        pulse.className = 'marker-pulse';
        el.appendChild(pulse);

        el.onclick = () => {
            if (getFollowBusId() === bus.bus_id) return;

            const map = getMap();
            if (map) {
                const maxBounds = map.getMaxBounds();
                if (maxBounds && !maxBounds.contains(targetPos)) {
                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Bus Diluar Area',
                            text: 'Posisi bus berada di luar jangkauan peta.',
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000
                        });
                    }
                    return;
                }

                setFollowBusId(bus.bus_id);
                map.jumpTo({ center: targetPos, zoom: 17.5 });
                document.querySelectorAll('.bus-item').forEach(i => i.classList.remove('active-focus'));
            }
        };

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat(targetPos)
            .setPopup(new maplibregl.Popup({ offset: 20, anchor: 'bottom' }).setHTML(content))
            .addTo(map);

        busMarkers[bus.bus_id] = {
            marker: marker
        };
    }
}

const notifiedState = new Map();

function checkAndShowArrivalNotification(bus, stop) {
    if (stop.dist > 0.25 || bus.speed <= 0) return;

    const key = `${bus.bus_id}-${stop.title}`;
    const now = Date.now();
    const cooldown = 5 * 60 * 1000;

    if (notifiedState.has(key) && (now - notifiedState.get(key) < cooldown)) {
        return;
    }

    showArrivalNotification(bus, stop);

    notifiedState.set(key, now);

    if (notifiedState.size > 50) {
        for (const [k, t] of notifiedState) {
            if (now - t > cooldown) notifiedState.delete(k);
        }
    }
}

function showArrivalNotification(bus, stop) {
    const container = document.getElementById('arrival-notification-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'arrival-card';

    const stopName = stop.title.replace('Halte ', '');

    el.innerHTML = `
        <div class="arrival-icon">
            <img src="/images/bipol.png" style="width:100%; height:100%; object-fit:contain;">
        </div>
        <div class="arrival-content">
            <h4>${bus.bus_id} Mendekat!</h4>
            <p>Akan tiba di ${stopName}</p>
        </div>
        <div class="arrival-time">
            <i class="fa-solid fa-clock"></i> Segera
        </div>
    `;

    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('leaving');
        el.addEventListener('animationend', () => {
            el.remove();
        });
    }, 6000);
}

export function removeInactiveMarkers(activeIds) {
    Object.keys(busMarkers).forEach(id => {
        if (!activeIds.has(id)) {
            busMarkers[id].marker.remove();
            delete busMarkers[id];
        }
    });
}
