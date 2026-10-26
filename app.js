const COMMUNITY_NAMES = ['หนองบัว', 'บ้านดอน', 'โคกสว่าง', 'ทุ่งทอง', 'คลองใหม่'];
const STATUS_LABELS = { active: 'กำลังใช้งาน', ready: 'พร้อมใช้งาน', offline: 'ออฟไลน์' };
const STATUS_COLORS = { active: '#52d3a1', ready: '#6fa8ff', offline: '#ff737c' };
let selectedId = 'BS-023';
let currentFilter = 'all';
let searchTerm = '';
let stoves = [];

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildStoves() {
  return Array.from({ length: 60 }, (_, index) => {
    const number = index + 1;
    const id = `BS-${String(number).padStart(3, '0')}`;
    const status = index < 18 ? 'active' : index < 57 ? 'ready' : 'offline';
    const community = COMMUNITY_NAMES[index % COMMUNITY_NAMES.length];
    const temperature = status === 'active' ? Math.round(148 + seededNoise(number) * 116) : status === 'ready' ? Math.round(34 + seededNoise(number) * 28) : 0;
    return {
      id,
      status,
      community,
      zone: ['โซนเหนือ', 'โซนกลาง', 'โซนตะวันออก', 'โซนใต้'][index % 4],
      temperature,
      usage: status === 'active' ? 2 + (index % 4) : status === 'ready' ? index % 2 : 0,
      duration: status === 'active' ? 35 + (index * 7) % 28 : 0,
      maxTemp: status === 'active' ? temperature + 47 + index % 21 : 0,
      signal: status === 'offline' ? 'ขาดการเชื่อมต่อ' : status === 'active' ? 'ดีมาก' : 'พร้อมรับข้อมูล',
      sensor: `TMP-${String(number).padStart(3, '0')}-A`,
      x: 92 + ((index * 137) % 810) + (index % 3) * 9,
      y: 80 + ((index * 79) % 385) + (index % 4) * 8,
    };
  });
}

function temperatureSeries(stove) {
  return Array.from({ length: 25 }, (_, i) => {
    if (stove.status === 'offline') return 0;
    if (stove.status === 'ready') return Math.max(28, Math.round(stove.temperature + Math.sin(i * 0.8) * 8));
    const wave = Math.sin((i - 2) * 0.62) * 32 + Math.sin(i * 1.37) * 12;
    const warmup = i < 4 ? i * 35 : 0;
    return Math.max(76, Math.round(stove.temperature + wave - 18 + warmup));
  });
}

function getSelected() {
  return stoves.find((stove) => stove.id === selectedId) || stoves[0];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function markerMarkup(stove) {
  const color = STATUS_COLORS[stove.status];
  const selected = stove.id === selectedId ? ' selected' : '';
  const hiddenByFilter = currentFilter !== 'all' && stove.status !== currentFilter;
  const matchesSearch = !searchTerm || `${stove.id} ${stove.community}`.toLowerCase().includes(searchTerm.toLowerCase());
  const dimmed = hiddenByFilter || !matchesSearch ? ' dimmed' : '';
  return `<g class="stove-marker${selected}${dimmed}" data-stove="${stove.id}" transform="translate(${stove.x} ${stove.y})"><circle class="marker-halo" r="13" fill="${color}"/><circle class="marker-core" r="6" fill="${color}"/><text class="marker-label" x="10" y="4">${stove.id}</text></g>`;
}

function renderMap() {
  document.getElementById('markerLayer').innerHTML = stoves.map(markerMarkup).join('');
  const selectedMarker = document.querySelector(`[data-stove="${selectedId}"]`);
  if (selectedMarker) selectedMarker.parentElement.appendChild(selectedMarker);
}

function renderStats() {
  const active = stoves.filter((stove) => stove.status === 'active').length;
  const offline = stoves.filter((stove) => stove.status === 'offline').length;
  document.getElementById('totalStoves').textContent = stoves.length;
  document.getElementById('activeStoves').textContent = active;
  document.getElementById('allCount').textContent = stoves.length;
  document.getElementById('activeCount').textContent = active;
  document.getElementById('offlineCount').textContent = offline;
  document.getElementById('usageToday').innerHTML = '87 <small>ครั้ง</small>';
  document.getElementById('fuelUsed').innerHTML = '126.8 <small>kg</small>';
}

function renderSelected() {
  const stove = getSelected();
  if (!stove) return;
  const statusClass = `status-${stove.status}`;
  document.getElementById('selectedName').textContent = stove.id;
  document.getElementById('selectedCommunity').textContent = `${stove.community} • ${stove.zone}`;
  const statusEl = document.getElementById('selectedStatus');
  statusEl.className = `status-pill ${statusClass}`;
  statusEl.textContent = `● ${STATUS_LABELS[stove.status]}`;
  document.getElementById('selectedTemp').textContent = stove.temperature;
  document.getElementById('selectedState').textContent = stove.status.toUpperCase();
  document.getElementById('selectedUsage').textContent = `${stove.usage} ครั้ง`;
  document.getElementById('selectedDuration').textContent = stove.status === 'offline' ? '—' : `${stove.duration} นาที`;
  document.getElementById('selectedMax').textContent = stove.status === 'offline' ? '—' : `${stove.maxTemp}°C`;
  document.getElementById('selectedSignal').textContent = stove.signal;
  document.getElementById('selectedSensor').textContent = stove.sensor;
  renderChart(stove);
}

function renderChart(stove) {
  const svg = document.getElementById('temperatureChart');
  const data = temperatureSeries(stove);
  const left = 45; const right = 880; const top = 16; const bottom = 245;
  const max = 360; const min = 0; const x = (i) => left + (i / (data.length - 1)) * (right - left); const y = (value) => bottom - ((value - min) / (max - min)) * (bottom - top);
  const points = data.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const areaPoints = `${left},${bottom} ${points} ${right},${bottom}`;
  let grid = '';
  [0, 100, 200, 300].forEach((value) => { grid += `<line class="chart-grid-line" x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}"/><text class="chart-axis" x="8" y="${y(value) + 4}">${value}°</text>`; });
  [0, 6, 12, 18, 24].forEach((value) => { grid += `<text class="chart-axis" x="${x(value) - 9}" y="266">${String((24 - value) % 24).padStart(2, '0')}:00</text>`; });
  const pointsMarkup = data.filter((_, index) => index % 4 === 0 || index === data.length - 1).map((value, i) => { const index = i === 0 ? 0 : i * 4; return `<circle class="chart-point" cx="${x(index)}" cy="${y(data[index])}" r="3.5"/>`; }).join('');
  svg.innerHTML = `<defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#52d3a1" stop-opacity=".25"/><stop offset="1" stop-color="#52d3a1" stop-opacity="0"/></linearGradient><filter id="chartGlow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${grid}<line class="chart-threshold" x1="${left}" y1="${y(100)}" x2="${right}" y2="${y(100)}"/><text class="chart-threshold-label" x="${right - 190}" y="${y(100) - 7}">เกณฑ์ 100°C</text><polygon class="chart-area" points="${areaPoints}"/><polyline class="chart-line" points="${points}"/>${pointsMarkup}`;
}

function renderEvents() {
  const eventStoves = stoves.filter((stove) => stove.status !== 'offline').slice(0, 5);
  const times = ['เมื่อ 2 นาทีที่แล้ว', 'เมื่อ 11 นาทีที่แล้ว', 'เมื่อ 23 นาทีที่แล้ว', 'เมื่อ 38 นาทีที่แล้ว', 'เมื่อ 51 นาทีที่แล้ว'];
  document.getElementById('eventsBody').innerHTML = eventStoves.map((stove, index) => `<tr><td>${stove.id}</td><td>${stove.community}</td><td>${index % 2 ? 'สิ้นสุดการใช้งาน' : 'เริ่มใช้งานเตา'}</td><td class="temp-cell">${stove.temperature}°C</td><td>${times[index]}</td><td><span class="event-status ${index % 2 ? 'event-stop' : 'event-start'}">${index % 2 ? 'COMPLETED' : 'ACTIVE'}</span></td></tr>`).join('');
}

function renderAll() {
  renderStats(); renderMap(); renderSelected(); renderEvents();
}

function showToast(message = 'อัปเดตข้อมูลจำลองแล้ว') {
  const toast = document.getElementById('toast');
  toast.textContent = message; toast.classList.add('show');
  window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function refreshData() {
  stoves = stoves.map((stove) => stove.status === 'active' ? { ...stove, temperature: Math.max(120, stove.temperature + Math.round((Math.random() - .5) * 12)) } : stove);
  const now = new Date();
  document.getElementById('lastUpdated').textContent = `วันนี้ ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
  renderAll(); showToast();
}

stoves = buildStoves();
document.getElementById('mapSvg').addEventListener('click', (event) => {
  const marker = event.target.closest('[data-stove]');
  if (!marker) return;
  selectedId = marker.dataset.stove; renderMap(); renderSelected();
});
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
  renderMap();
}));
document.getElementById('searchInput').addEventListener('input', (event) => { searchTerm = event.target.value.trim(); renderMap(); });
document.getElementById('refreshButton').addEventListener('click', refreshData);
document.getElementById('focusActiveButton').addEventListener('click', () => {
  currentFilter = 'active';
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item.dataset.filter === 'active'));
  const firstActive = stoves.find((stove) => stove.status === 'active');
  if (firstActive) selectedId = firstActive.id;
  renderAll(); document.getElementById('mapViewport').scrollIntoView({ behavior: 'smooth', block: 'center' });
});
document.getElementById('showAllButton').addEventListener('click', () => showToast('แสดง 87 รายการจำลองในระบบ'));
window.setInterval(refreshData, 12000);
renderAll();
