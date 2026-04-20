import { stops, bounds } from './data.js';
import { getMap, setFollowBusId, getFollowBusId, toggleRoute, closeAllPopups, getMapPadding } from './map.js';
import { getBusStatus, updateStatusConfig, GAS_ALERT_THRESHOLD } from './status.js';
import * as turf from 'https://cdn.jsdelivr.net/npm/@turf/turf@7/+esm';

let lastAlert = 0;

fetch('/api/config')
    .then(r => r.json())
    .then(config => {
        updateStatusConfig(config);
    })
    .catch(() => { });



export function setupControls() {
    document.getElementById('recenterBtn').onclick = () => {
        setFollowBusId(null);
        closeAllPopups();
        getMap().fitBounds(bounds, {
            padding: getMapPadding(),
            pitch: 0,
            bearing: 0,
            speed: 1.2,
            curve: 1.42,
            essential: true
        });
        document.querySelectorAll('.bus-item').forEach(i => i.classList.remove('active-focus'));
        if (window.innerWidth < 768) {
            const sheet = document.querySelector('.bottom-sheet');
            if (sheet) sheet.classList.add('collapsed');
        }
    };

    window.toggleRouteCard = (layerIdObj) => {
        toggleRoute(layerIdObj, null);
    }

    const toggleBtn = document.getElementById('toggleSheetBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sheet = document.querySelector('.bottom-sheet');
            sheet.classList.toggle('collapsed');
        });
    }

    if (window.innerWidth < 768) {
        const sheet = document.querySelector('.bottom-sheet');
        if (sheet) sheet.classList.add('collapsed');
    }

    window.addEventListener('online', () => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Online Kembali',
                showConfirmButton: false,
                timer: 3000
            });
        }
    });

    window.addEventListener('offline', () => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'warning',
                title: 'Koneksi Terputus',
                text: 'Beralih ke mode offline',
                showConfirmButton: false,
                timer: 5000
            });
        }
    });
}

export function updateSidebar(bus, list, index) {
    const item = document.createElement('div');
    item.className = 'bus-item animate-enter';
    item.style.animationDelay = `${index * 0.1}s`;
    item.id = `bus-item-${bus.bus_id}`;
    if (getFollowBusId() === bus.bus_id) item.classList.add('active-focus');

    const busStatus = getBusStatus(bus);
    let statusDot = busStatus.class;
    if (bus.gas_level > GAS_ALERT_THRESHOLD) statusDot = 'dot-red';

    const gasClass = bus.gas_level > GAS_ALERT_THRESHOLD ? 'text-danger' : '';
    const eta = calculateETA(bus);

    item.innerHTML = `
        <div class="bus-icon-wrapper"><img src="./images/bipol.png"></div>
        <div class="bus-info">
            <h4>${bus.bus_id} <span class="status-dot ${statusDot}"></span> <span class="eta-inline"><i class="fa-solid ${eta.icon}"></i> ${eta.text}</span></h4>
            <p style="margin-bottom: 2px;"><span><i class="fa-solid ${busStatus.icon}"></i> ${busStatus.status}</span> &bull;
            <span><i class="fa-solid fa-gauge"></i> ${bus.speed} km/h</span> &bull;
            <span class="${gasClass}"><i class="fa-solid fa-fire"></i> ${bus.gas_level}</span></p>
            <p style="opacity: 0.8; font-size: 0.85em;">
                <span><i class="fa-solid fa-cloud"></i> ${bus.co2 !== undefined ? bus.co2 : 0} PPM</span> &bull;
                <span><i class="fa-solid fa-wifi"></i> ${bus.rssi !== undefined ? bus.rssi : 0} dBm</span>
            </p>
        </div>`;
    item.onclick = () => {
        if (getFollowBusId() === bus.bus_id) return;

        const map = getMap();
        if (map) {
            const maxBounds = map.getMaxBounds();
            if (maxBounds && !maxBounds.contains([bus.longitude, bus.latitude])) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Bus Diluar Area',
                    text: 'Posisi bus berada di luar jangkauan peta.',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                return;
            }

            setFollowBusId(bus.bus_id);
            map.flyTo({ center: [bus.longitude, bus.latitude], zoom: 18, speed: 1.5, curve: 1 });
            document.querySelectorAll('.bus-item').forEach(i => i.classList.remove('active-focus'));
            if (window.innerWidth < 768) {
                const sheet = document.querySelector('.bottom-sheet');
                if (sheet) sheet.classList.add('collapsed');
            }
            item.classList.add('active-focus');
        }
    };
    list.appendChild(item);
}

export function calculateETA(bus) {
    const from = turf.point([bus.longitude, bus.latitude]);
    let minDist = Infinity;
    let nearestStop = '';
    stops.forEach(stop => {
        const to = turf.point([stop.lng, stop.lat]);
        const dist = turf.distance(from, to, { units: 'kilometers' });
        if (dist < minDist) { minDist = dist; nearestStop = stop.title; }
    });

    const displaySpeed = (bus.speed && bus.speed > 1) ? bus.speed : 20;

    if (minDist < 0.05) {
        return { text: `Tiba di ${nearestStop}`, icon: 'fa-check-circle', arrived: true };
    } else {
        const time = Math.ceil((minDist / displaySpeed) * 60);
        return { text: `${time} min ke ${nearestStop}`, icon: 'fa-clock', arrived: false };
    }
}

export function checkAlerts(bus) {
    if (bus.gas_level > GAS_ALERT_THRESHOLD && Date.now() - lastAlert > 30000) {
        Swal.fire({
            html: `
                <div class="gas-warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="gas-alert-title">GAS TINGGI DETEKSI</div>
                <div class="gas-value-display">${bus.gas_level}</div>
                <div class="gas-alert-text">Segera periksa kondisi armada ${bus.bus_id}</div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'MENGERTI',
            confirmButtonColor: '#BF1E2E',
            background: 'transparent',
            customClass: { popup: 'gas-alert-popup' },
            backdrop: `rgba(191,30,46,0.2)`
        });
        lastAlert = Date.now();
    }
}

let currentTab = 'home';

export function switchTab(tab) {
    if (tab === currentTab && tab !== 'home') {
        tab = 'home';
    }
    currentTab = tab;

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const navItem = document.querySelector(`.nav-item[onclick*="'${tab}'"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    const sheet = document.querySelector('.bottom-sheet');
    const infoPage = document.getElementById('info-page');
    const faqPage = document.getElementById('faq-page');
    const routeView = document.getElementById('route-view');

    if (tab === 'home') {
        sheet.classList.remove('hidden');
        infoPage.classList.remove('active-page');
        faqPage.classList.remove('active-page');
        routeView.classList.remove('active-page');
        routeView.classList.remove('closing');

        if (getFollowBusId()) {
            setFollowBusId(null);
            document.querySelectorAll('.bus-item').forEach(i => i.classList.remove('active-focus'));
        }
        closeAllPopups();

        if (getMap()) {
            getMap().fitBounds(bounds, {
                padding: getMapPadding(),
                speed: 1.2,
                curve: 1.42,
                essential: true
            });
        }

        if (window.innerWidth < 768) {
            sheet.classList.add('collapsed');
        }

    } else if (tab === 'map') {
        sheet.classList.add('hidden');
        infoPage.classList.remove('active-page');
        faqPage.classList.remove('active-page');
        routeView.classList.add('active-page');

        getMap().resize();
        getMap().fitBounds(bounds, {
            padding: { top: 20, bottom: 80, left: 20, right: 20 },
            speed: 0.8,
            curve: 1.2
        });
    } else if (tab === 'announcement') {
        sheet.classList.add('hidden');
        routeView.classList.remove('active-page');
        faqPage.classList.remove('active-page');
        infoPage.classList.add('active-page');
    } else if (tab === 'faq') {
        sheet.classList.add('hidden');
        routeView.classList.remove('active-page');
        infoPage.classList.remove('active-page');
        faqPage.classList.add('active-page');
        loadBusPlates();
    }
}

export async function loadBusPlates() {
    const select = document.getElementById('busPlate');
    if (!select) return;

    if (select.options.length > 1) return;

    try {
        const res = await fetch('/api/bus-plates');
        const plates = await res.json();

        plates.forEach(plate => {
            const opt = document.createElement('option');
            opt.value = plate;
            opt.textContent = plate;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

export function viewImage(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('img01');
    modal.style.display = "block";
    modalImg.src = src;
}

export function closeImage() {
    const modal = document.getElementById('image-modal');
    modal.style.display = "none";
}

window.switchTab = switchTab;
window.viewImage = viewImage;
window.closeImage = closeImage;
