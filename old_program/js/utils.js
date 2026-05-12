// ============= UTILITY FUNCTIONS =============

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

const WEAPON_COLORS = {
  BALLISTIC: '#f59e0b', ENERGY: '#3b82f6', MISSILE: '#22c55e',
  HYBRID: '#eab308', UNIVERSAL: '#e5e7eb', LAUNCH_BAY: '#a855f7',
  SYNERGY: '#06b6d4', COMPOSITE: '#f97316', DECORATIVE: '#6b7280', SYSTEM: '#6b7280', STATION_MODULE: '#6b7280'
};
const SLOT_RADIUS = {LARGE: 12, MEDIUM: 8, SMALL: 5};

const TABLE_COLUMNS = {
  // 不再硬编码——由 CSV 表头动态生成
  // 这里只定义优先显示顺序（靠前的列先显示），其余列按原始顺序追加
  ships: ['name','id','designation','system id','hitpoints','armor rating','shield type','shield arc','shield efficiency','max flux','flux dissipation','max speed','ordnance points','fleet pts','fighter bays','cargo','fuel','min crew','max crew','tags'],
  weapons: ['name','id','type','range','damage/shot','damage/second','emp','OPs','proj speed','ammo','ammo/sec','reload size','energy/shot','energy/second','chargeup','chargedown','burst size','burst delay','min spread','max spread','beam speed','launch speed','flight time','hints','tags'],
  wings: ['id','variant','tags','op cost','num','role','role desc','refit','formation','range'],
  hullmods: ['name','id','tier','tags','uiTags','cost_frigate','cost_dest','cost_cruiser','cost_capital','script','desc','short','sModDesc','sprite'],
  industries: ['name','id','build time','upkeep','tags','desc','order']
};

function getColumnsForTab(tab) {
  // 合并：优先列 + CSV 中剩余列（去除 _ 开头的内部字段）
  const priority = TABLE_COLUMNS[tab] || [];
  const csvHeaders = (DATA && DATA.csvHeaders && DATA.csvHeaders[tab]) ? DATA.csvHeaders[tab] : [];
  const seen = new Set();
  const result = [];
  // 先添加优先列（如果在 CSV 中存在）
  priority.forEach(col => {
    if (csvHeaders.includes(col) && !seen.has(col)) {
      result.push(col);
      seen.add(col);
    }
  });
  // 再追加 CSV 中剩余列
  csvHeaders.forEach(col => {
    if (col && !col.startsWith('_') && !seen.has(col)) {
      result.push(col);
      seen.add(col);
    }
  });
  return result;
}
