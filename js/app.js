// ============= GLOBALS =============
let DATA = null;
let currentTab = 'ships';
let currentFaction = 'all';
let searchText = '';
let changes = {}; // {tab: {rowIdx: {col: newValue}}}
let sortState = {}; // {tab: {col, asc}}
let originalData = {}; // deep copy for revert
let selectedRowId = null; // currently selected row's id

// ============= INIT =============
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupTabs();
  setupFactions();
  await loadData();
  renderTable();
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      searchText = '';
      document.getElementById('searchInput').value = '';
      renderTable();
    });
  });
}

function setupFactions() {
  // Built dynamically after data loads
}

function buildFactionButtons() {
  if (!DATA || !DATA.factionMeta) return;
  const container = document.getElementById('factionBtns');
  let html = `<button class="faction-btn active" data-f="all" style="border-color:var(--text-dim);color:var(--text-dim)" onclick="setFaction('all',this)">全部</button>`;
  for (const [fid, fm] of Object.entries(DATA.factionMeta)) {
    html += `<button class="faction-btn" data-f="${fid}" style="border-color:${fm.color};color:${fm.color}" onclick="setFaction('${fid}',this)">${fm.name}</button>`;
  }
  container.innerHTML = html;
  // Set title from mod info
  const title = DATA.modInfo ? DATA.modInfo.name : 'Mod';
  document.getElementById('toolTitle').textContent = title + ' 配置工具';
  document.title = title + ' - 配置工具';
}

function setFaction(fid, el) {
  currentFaction = fid;
  document.querySelectorAll('.faction-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'transparent';
  });
  el.classList.add('active');
  const c = el.style.borderColor || 'var(--text-dim)';
  el.style.background = c;
  renderTable();
}

function onSearch() {
  searchText = document.getElementById('searchInput').value;
  renderTable();
}

function revertChanges() {
  DATA.ships = JSON.parse(JSON.stringify(originalData.ships));
  DATA.weapons = JSON.parse(JSON.stringify(originalData.weapons));
  DATA.wings = JSON.parse(JSON.stringify(originalData.wings));
  DATA.hullmods = JSON.parse(JSON.stringify(originalData.hullmods));
  DATA.industries = JSON.parse(JSON.stringify(originalData.industries));
  changes = {ships:{}, weapons:{}, wings:{}, hullmods:{}, industries:{}};
  renderTable();
  showToast('已撤销所有修改', 'success');
}

function updateFloatActions() {
  const hasChanges = Object.values(changes).some(tab => Object.keys(tab).length > 0);
  document.getElementById('floatActions').style.display = hasChanges ? 'flex' : 'none';
}
