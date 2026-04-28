// ─────────────────────────────────────────────
//  Agricultural Mandi Optimizer – script.js
//  Changes: CSV-driven data, fixed ETA +/- buttons,
//  disabled minus at floor, best-by-profit &
//  best-by-distance summary cards.
// ─────────────────────────────────────────────

// ── State ──────────────────────────────────────
let allMandis       = [];
let timeAdjustments = {};
let lastRanking     = [];
let lastSpeed       = 60;

// ── CSV Loader ─────────────────────────────────
async function loadCSV() {
    try {
        const res  = await fetch('./mandis.csv');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const text = await res.text();
        return parseCSV(text);
    } catch (e) {
        console.warn('CSV load failed – using fallback data', e);
        return getFallbackData();
    }
}

function parseCSV(text) {
    const lines  = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const cols = line.split(',');
        const obj  = {};
        header.forEach((h, i) => obj[h] = cols[i] ? cols[i].trim() : '');
        return {
            id:             parseInt(obj.id),
            name:           obj.name,
            district:       obj.district,
            state:          obj.state,
            lat:            parseFloat(obj.lat),
            lng:            parseFloat(obj.lng),
            price_per_unit: parseInt(obj.price_per_unit),
            base_distance:  parseInt(obj.distance_from_0)
        };
    });
}

function getFallbackData() {
    return [
        { id:0,  name:'Lucknow Krishi Mandi',    district:'Lucknow',       state:'UP', lat:26.8467, lng:80.9462, price_per_unit:0,   base_distance:0  },
        { id:1,  name:'Agra Mandi Samiti',        district:'Agra',          state:'UP', lat:27.1767, lng:78.0081, price_per_unit:520,  base_distance:10 },
        { id:2,  name:'Varanasi Sabzi Mandi',     district:'Varanasi',      state:'UP', lat:25.3176, lng:82.9739, price_per_unit:490,  base_distance:3  },
        { id:3,  name:'Kanpur Anaj Mandi',        district:'Kanpur',        state:'UP', lat:26.4499, lng:80.3319, price_per_unit:560,  base_distance:8  },
        { id:4,  name:'Allahabad Mandi',          district:'Prayagraj',     state:'UP', lat:25.4358, lng:81.8463, price_per_unit:610,  base_distance:11 },
        { id:5,  name:'Mathura Mandi Samiti',     district:'Mathura',       state:'UP', lat:27.4924, lng:77.6737, price_per_unit:540,  base_distance:6  },
        { id:6,  name:'Meerut Krishi Upaj Mandi', district:'Meerut',        state:'UP', lat:28.9845, lng:77.7064, price_per_unit:505,  base_distance:9  },
        { id:7,  name:'Bareilly Mandi',           district:'Bareilly',      state:'UP', lat:28.3670, lng:79.4304, price_per_unit:530,  base_distance:14 },
        { id:8,  name:'Aligarh Mandi Samiti',     district:'Aligarh',       state:'UP', lat:27.8974, lng:78.0880, price_per_unit:515,  base_distance:7  },
        { id:9,  name:'Moradabad Mandi',          district:'Moradabad',     state:'UP', lat:28.8386, lng:78.7733, price_per_unit:525,  base_distance:12 },
        { id:10, name:'Gorakhpur Mandi',          district:'Gorakhpur',     state:'UP', lat:26.7606, lng:83.3732, price_per_unit:575,  base_distance:15 },
        { id:11, name:'Firozabad Mandi',          district:'Firozabad',     state:'UP', lat:27.1591, lng:78.3957, price_per_unit:545,  base_distance:5  },
        { id:12, name:'Jhansi Mandi Samiti',      district:'Jhansi',        state:'UP', lat:25.4484, lng:78.5685, price_per_unit:590,  base_distance:13 },
        { id:13, name:'Rampur Mandi',             district:'Rampur',        state:'UP', lat:28.8159, lng:79.0258, price_per_unit:510,  base_distance:10 },
        { id:14, name:'Saharanpur Mandi',         district:'Saharanpur',    state:'UP', lat:29.9680, lng:77.5460, price_per_unit:535,  base_distance:16 },
        { id:15, name:'Muzaffarnagar Mandi',      district:'Muzaffarnagar', state:'UP', lat:29.4727, lng:77.7085, price_per_unit:550,  base_distance:11 },
        { id:16, name:'Bijnor Mandi Samiti',      district:'Bijnor',        state:'UP', lat:29.3724, lng:78.1353, price_per_unit:520,  base_distance:13 },
        { id:17, name:'Shahjahanpur Mandi',       district:'Shahjahanpur',  state:'UP', lat:27.8833, lng:79.9050, price_per_unit:500,  base_distance:9  },
        { id:18, name:'Hardoi Mandi',             district:'Hardoi',        state:'UP', lat:27.3956, lng:80.1306, price_per_unit:515,  base_distance:7  },
        { id:19, name:'Etawah Mandi Samiti',      district:'Etawah',        state:'UP', lat:26.7715, lng:79.0239, price_per_unit:570,  base_distance:8  }
    ];
}

// ── Graph (built from CSV distances) ───────────
function buildGraphEdges(mandis) {
    const edges = [];
    const n = mandis.length;
    // Connect each mandi to up to 4 nearby ones by index proximity
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n && j <= i + 4; j++) {
            const w = Math.abs(mandis[j].base_distance - mandis[i].base_distance) + 1;
            edges.push({ src: i, dest: j, weight: w });
            edges.push({ src: j, dest: i, weight: w });
        }
    }
    return edges;
}

function initializeGraph(mandis) {
    const n     = mandis.length;
    const edges = buildGraphEdges(mandis);
    const adj   = Array.from({ length: n }, () => []);
    edges.forEach(e => adj[e.src].push({ dest: e.dest, weight: e.weight }));
    return { vertices: n, adjLists: adj };
}

// ── Dijkstra ────────────────────────────────────
function dijkstras(graph, src) {
    const dist = Array(graph.vertices).fill(Infinity);
    dist[src]  = 0;
    const pq   = [{ dist: 0, vertex: src }];

    while (pq.length > 0) {
        pq.sort((a, b) => a.dist - b.dist);
        const { dist: d, vertex: u } = pq.shift();
        if (d > dist[u]) continue;
        for (const edge of graph.adjLists[u]) {
            const nd = dist[u] + edge.weight;
            if (nd < dist[edge.dest]) {
                dist[edge.dest] = nd;
                pq.push({ dist: nd, vertex: edge.dest });
            }
        }
    }
    return dist;
}

// ── Profit Optimiser ────────────────────────────
function optimizeProfit(distances, mandis, srcId, quantity, transportCost) {
    const srcDist = mandis[srcId] ? mandis[srcId].base_distance : 0;
    const ranking = [];

    mandis.forEach((m, i) => {
        if (i === srcId)              return;
        if (distances[i] === Infinity) return;

        // Real km = absolute difference of base distances from CSV
        const kmDist  = Math.abs(m.base_distance - srcDist) + distances[i];
        const revenue = m.price_per_unit * quantity;
        const cost    = Math.round(kmDist * transportCost);
        const profit  = revenue - cost;

        ranking.push({
            mandi:    i,
            name:     m.name,
            district: m.district,
            profit,
            distance: kmDist,
            price:    m.price_per_unit,
            revenue,
            cost
        });
    });

    ranking.sort((a, b) => b.profit - a.profit);
    return ranking;
}

// ── ETA Helpers ─────────────────────────────────
function calculateETA(distanceKm, speedKmh) {
    const totalMins = Math.max(1, Math.round((distanceKm / speedKmh) * 60));
    return {
        hours:        Math.floor(totalMins / 60),
        minutes:      totalMins % 60,
        totalMinutes: totalMins,
        formatted:    `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`
    };
}

function getArrivalTime(totalMinutes) {
    const arrival = new Date(Date.now() + Math.max(0, totalMinutes) * 60000);
    return `${String(arrival.getHours()).padStart(2,'0')}:${String(arrival.getMinutes()).padStart(2,'0')}`;
}

function updateCurrentTime() {
    const el = document.getElementById('currentTime');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-IN', {
        weekday:'short', year:'numeric', month:'short',
        day:'numeric', hour:'2-digit', minute:'2-digit'
    });
}

// ── Populate Farmer Dropdown ─────────────────────
function populateFarmerDropdown(mandis) {
    const sel = document.getElementById('farmerLocation');
    sel.innerHTML = '';
    mandis.forEach(m => {
        const opt       = document.createElement('option');
        opt.value       = m.id;
        opt.textContent = `${m.district} – ${m.name}`;
        sel.appendChild(opt);
    });
}

// ── Main Calculate ───────────────────────────────
function calculateOptimalRoute() {
    if (!allMandis.length) return;

    const srcId         = parseInt(document.getElementById('farmerLocation').value);
    const quantity      = parseFloat(document.getElementById('cropQuantity').value)  || 100;
    const transportRate = parseFloat(document.getElementById('transportRate').value) || 2;
    const vehicleSpeed  = parseFloat(document.getElementById('vehicleSpeed').value)  || 60;

    lastSpeed = vehicleSpeed;

    const graph     = initializeGraph(allMandis);
    const distances = dijkstras(graph, srcId);
    const ranking   = optimizeProfit(distances, allMandis, srcId, quantity, transportRate);

    lastRanking = ranking;

    displayProfitRanking(ranking);
    displayETA(ranking, vehicleSpeed);
    displayBestMandis(ranking);
    updateCurrentTime();
}

// ── Display: Profit Ranking ──────────────────────
function displayProfitRanking(ranking) {
    let html = '';
    const top = ranking.slice(0, 5);   // show top 5 only
    top.forEach((m, idx) => {
        const cls = m.profit >= 0 ? 'positive' : 'negative';
        html += `
        <div class="result-card">
            <h3>🏅 Rank ${idx + 1} – ${m.name}</h3>
            <p><span class="result-label">District:</span>
               <span class="result-value">${m.district}</span></p>
            <p><span class="result-label">Net Profit:</span>
               <span class="result-value ${cls}">₹ ${m.profit.toLocaleString('en-IN')}</span></p>
            <p><span class="result-label">Distance:</span>
               <span class="result-value">${m.distance} km</span></p>
            <p><span class="result-label">Market Price:</span>
               <span class="result-value">₹ ${m.price}/unit</span></p>
            <p><span class="result-label">Revenue:</span>
               <span class="result-value positive">₹ ${m.revenue.toLocaleString('en-IN')}</span></p>
            <p><span class="result-label">Transport Cost:</span>
               <span class="result-value negative">₹ ${m.cost.toLocaleString('en-IN')}</span></p>
        </div>`;
    });
    document.getElementById('profitResults').innerHTML =
        html || '<p style="color:#888;padding:20px;">No reachable mandis found.</p>';
}

// ── Display: ETA ─────────────────────────────────
function displayETA(ranking, vehicleSpeed) {
    let html = '';
    const top = ranking.slice(0, 5);   // show top 5 only

    top.forEach((m, idx) => {
        const adj     = timeAdjustments[m.mandi] || 0;

        // Base ETA at user's chosen speed (for display)
        const eta     = calculateETA(m.distance, vehicleSpeed);

        // Hard floor = minimum physically possible time = distance / 60 km/h
        // The user can never press minus below this value.
        const floorMins = Math.ceil((m.distance / 60) * 60); // distance÷60kmh → hours → minutes

        const adjMins      = Math.max(floorMins, eta.totalMinutes + adj);
        const adjH         = Math.floor(adjMins / 60);
        const adjM         = adjMins % 60;
        const adjFormatted = `${adjH}h ${adjM}m`;
        const arrival      = getArrivalTime(adjMins);
        const isBest       = idx === 0;

        // Minus is disabled when one more click would go below the physical floor
        const afterMinus   = eta.totalMinutes + adj - 15;
        const canMinus     = afterMinus >= floorMins;
        const minusDis     = canMinus ? '' : 'disabled';

        html += `
        <div class="eta-card${isBest ? ' best-option' : ''}">
            <div class="${isBest ? 'best-badge' : 'eta-rank'}">${isBest ? '⭐ BEST OPTION' : `Option ${idx + 1}`}</div>
            <h4>${m.name}</h4>
            <p class="eta-district">${m.district}</p>
            <p>Distance: <strong>${m.distance} km</strong></p>
            <div class="eta-value">${adjFormatted}</div>
            <div class="eta-unit">Travel Time at ${vehicleSpeed} km/h</div>
            <div class="eta-controls">
                <button class="eta-btn minus-btn"
                        onclick="adjustTime(${m.mandi}, -15)"
                        ${minusDis}
                        title="Subtract 15 minutes">−</button>
                <span class="eta-time-display">${adjFormatted}</span>
                <button class="eta-btn plus-btn"
                        onclick="adjustTime(${m.mandi}, 15)"
                        title="Add 15 minutes">+</button>
            </div>
            <div class="eta-arrival">🕐 ETA: ${arrival}</div>
            <div class="eta-floor-note">Min possible: ${Math.floor(floorMins/60)}h ${floorMins%60}m @ 60 km/h</div>
            <p class="eta-profit">📊 Profit: ₹${m.profit.toLocaleString('en-IN')}</p>
        </div>`;
    });

    document.getElementById('etaResults').innerHTML =
        html || '<p style="color:#888;padding:20px;">No results to display.</p>';
}

// ── Display: Best Mandi Summary ──────────────────
function displayBestMandis(ranking) {
    const el = document.getElementById('bestMandiSummary');
    if (!el || !ranking.length) return;

    const bestProfit   = ranking[0];
    const bestDistance = [...ranking].sort((a, b) => a.distance - b.distance)[0];

    el.innerHTML = `
    <div class="best-summary-grid">
        <div class="best-card profit-card">
            <div class="best-card-icon">💰</div>
            <div class="best-card-label">Best Mandi by Profit</div>
            <div class="best-card-name">${bestProfit.name}</div>
            <div class="best-card-district">${bestProfit.district}</div>
            <div class="best-card-value">₹ ${bestProfit.profit.toLocaleString('en-IN')}</div>
            <div class="best-card-sub">₹${bestProfit.price}/unit &nbsp;·&nbsp; ${bestProfit.distance} km away</div>
        </div>
        <div class="best-card distance-card">
            <div class="best-card-icon">🛣️</div>
            <div class="best-card-label">Best Mandi by Distance</div>
            <div class="best-card-name">${bestDistance.name}</div>
            <div class="best-card-district">${bestDistance.district}</div>
            <div class="best-card-value">${bestDistance.distance} km</div>
            <div class="best-card-sub">₹${bestDistance.price}/unit &nbsp;·&nbsp; Profit ₹${bestDistance.profit.toLocaleString('en-IN')}</div>
        </div>
    </div>`;
}

// ── Adjust ETA time (+/−) ────────────────────────
function adjustTime(mandiId, deltaMinutes) {
    if (!timeAdjustments[mandiId]) timeAdjustments[mandiId] = 0;

    const m = lastRanking.find(r => r.mandi === mandiId);
    if (!m) return;

    const eta       = calculateETA(m.distance, lastSpeed);
    // Physical minimum: time to cover the distance at exactly 60 km/h
    const floorMins = Math.ceil((m.distance / 60) * 60);

    const proposed  = eta.totalMinutes + timeAdjustments[mandiId] + deltaMinutes;

    // Never allow going below the physical floor
    if (proposed < floorMins) {
        timeAdjustments[mandiId] = floorMins - eta.totalMinutes;
    } else {
        timeAdjustments[mandiId] += deltaMinutes;
    }

    displayETA(lastRanking, lastSpeed);
}

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    allMandis = await loadCSV();
    populateFarmerDropdown(allMandis);

    ['farmerLocation', 'cropQuantity', 'transportRate', 'vehicleSpeed'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            timeAdjustments = {};
            calculateOptimalRoute();
        });
    });

    calculateOptimalRoute();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
});
