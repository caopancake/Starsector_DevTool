// ============= WEAPON EDITOR STATE =============
let weaponData = null;
let weaponId = null;
let weaponMode = 'turret';
let weaponSelectedBarrel = -1;
let weaponCanvas = null;
let weaponCtx = null;
let weaponImg = null;
let weaponScale = 1;
let weaponPan = {x: 0, y: 0};
let weaponDragging = false;
let weaponLastMouse = {x: 0, y: 0};
let weaponIsPanning = false;
let weaponDragTarget = null;
let weaponUndoStack = [];
let weaponRedoStack = [];
const WEAPON_UNDO_LIMIT = 250;
let weaponSectionState = {};

// ============= DEBUG =============
function wpnLog(...args) {
  if (typeof DEBUG !== 'undefined' && DEBUG) console.log('[WeaponEditor]', ...args);
}

// ============= UNDO / REDO =============
function wpnPushUndo() {
  if (!weaponData) return;
  weaponUndoStack.push(JSON.stringify(weaponData));
  if (weaponUndoStack.length > WEAPON_UNDO_LIMIT) weaponUndoStack.shift();
  weaponRedoStack = [];
}

function wpnUndo() {
  if (!weaponData || weaponUndoStack.length === 0) return;
  weaponRedoStack.push(JSON.stringify(weaponData));
  weaponData = JSON.parse(weaponUndoStack.pop());
  weaponSelectedBarrel = -1;
  wpnRenderSidebar();
  wpnDrawCanvas();
  showToast('撤销', 'success');
}

function wpnRedo() {
  if (!weaponData || weaponRedoStack.length === 0) return;
  weaponUndoStack.push(JSON.stringify(weaponData));
  weaponData = JSON.parse(weaponRedoStack.pop());
  weaponSelectedBarrel = -1;
  wpnRenderSidebar();
  wpnDrawCanvas();
  showToast('重做', 'success');
}

document.addEventListener('keydown', e => {
  if (!weaponData) return;
  if (!document.getElementById('weaponEditorModal').classList.contains('show')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); wpnUndo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); wpnRedo(); }
});

// ============= OPEN / CLOSE =============
function openWeaponEditor(id) {
  weaponId = id;

  // Try to load wpn data, or create default template
  if (DATA.wpnFiles && DATA.wpnFiles[id]) {
    weaponData = JSON.parse(JSON.stringify(DATA.wpnFiles[id]));
  } else {
    // No .wpn file - create default template based on CSV data
    const csvRow = DATA.weapons ? DATA.weapons.find(w => w.id === id) : null;
    const wType = csvRow ? (csvRow.type || 'BALLISTIC').toUpperCase() : 'BALLISTIC';
    const hasBeamSpeed = csvRow && csvRow['beam speed'] && csvRow['beam speed'] !== '';
    weaponData = {
      id: id,
      specClass: hasBeamSpeed ? 'beam' : 'projectile',
      type: wType,
      size: 'SMALL',
      turretSprite: '',
      turretGunSprite: '',
      hardpointSprite: '',
      hardpointGunSprite: '',
      turretOffsets: [10, 0],
      turretAngleOffsets: [0],
      hardpointOffsets: [15, 0],
      hardpointAngleOffsets: [0],
      barrelMode: 'ALTERNATING',
      animationType: 'MUZZLE_FLASH',
      projectileSpecId: '',
      fireSoundTwo: ''
    };
    if (hasBeamSpeed) {
      weaponData.fringeColor = [100, 200, 255, 200];
      weaponData.coreColor = [255, 255, 255, 255];
      weaponData.glowColor = [100, 200, 255, 100];
      weaponData.width = 10;
    }
    showToast(id + ': 无 .wpn 文件，使用默认模板。保存后将创建文件。', 'success');
  }

  weaponMode = 'turret';
  weaponSelectedBarrel = -1;
  weaponScale = 1;
  weaponPan = {x: 0, y: 0};
  weaponUndoStack = [];
  weaponRedoStack = [];
  weaponSectionState = {'基础属性': true, '发射点': true};

  wpnLog('openWeaponEditor', id, 'specClass:', weaponData.specClass, 'type:', weaponData.type);

  document.getElementById('weaponEditorTitle').textContent = '编辑武器: ' + (weaponData.id || id);
  document.getElementById('weaponEditorModal').classList.add('show');
  document.querySelectorAll('[data-wmode]').forEach(b => b.classList.toggle('active', b.dataset.wmode === 'turret'));

  wpnLoadSprite(() => {
    wpnInitCanvas();
    wpnRenderSidebar();
    wpnDrawCanvas();
  });
}

function closeWeaponEditor() {
  document.getElementById('weaponEditorModal').classList.remove('show');
  weaponData = null;
  weaponId = null;
}

function setWeaponViewMode(mode) {
  weaponMode = mode;
  weaponSelectedBarrel = -1;
  document.querySelectorAll('[data-wmode]').forEach(b => b.classList.toggle('active', b.dataset.wmode === mode));
  wpnLog('setWeaponViewMode', mode);
  wpnLoadSprite(() => {
    wpnRenderSidebar();
    wpnDrawCanvas();
  });
}

// ============= SPRITE LOADING =============
function wpnGetSpriteField() {
  if (weaponMode === 'turret') return 'turretSprite';
  return 'hardpointSprite';
}

function wpnLoadSprite(cb) {
  weaponImg = new Image();
  const field = wpnGetSpriteField();
  const spritePath = weaponData[field];
  if (spritePath) {
    weaponImg.src = '/api/sprite/' + spritePath;
  }
  weaponImg.onload = () => { if (cb) cb(); };
  weaponImg.onerror = () => { if (cb) cb(); };
  setTimeout(() => { if (!weaponCanvas && cb) cb(); }, 150);
}

// ============= CANVAS INIT =============
function wpnInitCanvas() {
  const panel = document.getElementById('weaponCanvasPanel');
  weaponCanvas = document.getElementById('weaponCanvas');
  weaponCtx = weaponCanvas.getContext('2d');

  const rect = panel.getBoundingClientRect();
  weaponCanvas.width = rect.width;
  weaponCanvas.height = rect.height;

  if (weaponImg && weaponImg.width) {
    const sw = (rect.width * 0.6) / weaponImg.width;
    const sh = (rect.height * 0.6) / weaponImg.height;
    weaponScale = Math.min(sw, sh);
  } else {
    weaponScale = 2;
  }
  weaponPan = {x: 0, y: 0};

  weaponCanvas.onmousedown = wpnOnMouseDown;
  weaponCanvas.onmousemove = wpnOnMouseMove;
  weaponCanvas.onmouseup = wpnOnMouseUp;
  weaponCanvas.onwheel = wpnOnWheel;
  weaponCanvas.oncontextmenu = e => e.preventDefault();
  wpnLog('wpnInitCanvas', 'size:', weaponCanvas.width, 'x', weaponCanvas.height, 'scale:', weaponScale.toFixed(3));
}

function wpnGetCenter() {
  if (!weaponCanvas) return {x: 0, y: 0};
  return {
    x: weaponCanvas.width / 2 + weaponPan.x,
    y: weaponCanvas.height / 2 + weaponPan.y
  };
}

// Weapon coord → canvas pixel
// .wpn offset: [x=forward(up), y=right]
// Canvas: right = +canvasX, up = -canvasY
function wpnToCanvas(offsetX, offsetY) {
  const cc = wpnGetCenter();
  return {
    x: cc.x + offsetY * weaponScale,
    y: cc.y - offsetX * weaponScale
  };
}

// Canvas pixel → weapon coord
function canvasToWpn(px, py) {
  const cc = wpnGetCenter();
  return {
    x: -(py - cc.y) / weaponScale,
    y: (px - cc.x) / weaponScale
  };
}

// ============= DRAWING =============
function wpnDrawCanvas() {
  if (!weaponCtx || !weaponCanvas) return;
  const ctx = weaponCtx;
  const w = weaponCanvas.width, h = weaponCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, w, h);
  wpnDrawGrid(ctx, w, h);

  const cc = wpnGetCenter();

  // Draw sprite
  if (weaponImg && weaponImg.width) {
    const imgW = weaponImg.width * weaponScale;
    const imgH = weaponImg.height * weaponScale;
    // Sprite center = canvas center (weapon sprite origin is at center of image)
    const drawX = cc.x - imgW / 2;
    const drawY = cc.y - imgH / 2;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(weaponImg, drawX, drawY, imgW, imgH);
    ctx.globalAlpha = 1.0;
  }

  // Draw center crosshair
  ctx.beginPath();
  ctx.moveTo(cc.x - 12, cc.y);
  ctx.lineTo(cc.x + 12, cc.y);
  ctx.moveTo(cc.x, cc.y - 12);
  ctx.lineTo(cc.x, cc.y + 12);
  ctx.strokeStyle = '#ffffff44';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw barrel firing points
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const anglesKey = weaponMode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
  const offsets = weaponData[offsetsKey] || [];
  const angles = weaponData[anglesKey] || [];
  const barrelCount = Math.floor(offsets.length / 2);

  for (let i = 0; i < barrelCount; i++) {
    const ox = offsets[i * 2];
    const oy = offsets[i * 2 + 1];
    const angle = angles[i] || 0;
    const p = wpnToCanvas(ox, oy);
    const isSelected = weaponSelectedBarrel === i;

    // Direction line
    const lineLen = 30;
    const angleRad = -angle * Math.PI / 180; // 0 = forward(up), positive = clockwise
    const dirX = p.x + Math.sin(angleRad) * lineLen;
    const dirY = p.y - Math.cos(angleRad) * lineLen;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(dirX, dirY);
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#ef4444aa';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.stroke();

    // Arrow tip
    const arrowSize = 6;
    const arrowAngle = Math.atan2(dirY - p.y, dirX - p.x);
    ctx.beginPath();
    ctx.moveTo(dirX, dirY);
    ctx.lineTo(dirX - arrowSize * Math.cos(arrowAngle - 0.4), dirY - arrowSize * Math.sin(arrowAngle - 0.4));
    ctx.lineTo(dirX - arrowSize * Math.cos(arrowAngle + 0.4), dirY - arrowSize * Math.sin(arrowAngle + 0.4));
    ctx.closePath();
    ctx.fillStyle = isSelected ? '#fbbf24' : '#ef4444aa';
    ctx.fill();

    // Selection ring
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Barrel circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, isSelected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#fbbf24' : '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Barrel number
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), p.x, p.y);
  }
}

function wpnDrawGrid(ctx, w, h) {
  const step = 50 * weaponScale;
  if (step < 5) return;
  ctx.strokeStyle = '#1e293b44';
  ctx.lineWidth = 0.5;
  const cc = wpnGetCenter();
  const offX = cc.x % step, offY = cc.y % step;
  for (let x = offX; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = offY; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// ============= CANVAS INTERACTION =============
function wpnOnMouseDown(e) {
  const rect = weaponCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  weaponLastMouse = {x: mx, y: my};

  if (e.button === 2) { weaponIsPanning = true; return; }

  // Hit test barrels
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const offsets = weaponData[offsetsKey] || [];
  const barrelCount = Math.floor(offsets.length / 2);

  for (let i = barrelCount - 1; i >= 0; i--) {
    const ox = offsets[i * 2];
    const oy = offsets[i * 2 + 1];
    const p = wpnToCanvas(ox, oy);
    if (Math.hypot(mx - p.x, my - p.y) < 14) {
      wpnPushUndo();
      weaponSelectedBarrel = i;
      weaponDragging = true;
      weaponDragTarget = 'barrel';
      wpnRenderSidebar();
      wpnDrawCanvas();
      return;
    }
  }

  // Deselect
  weaponSelectedBarrel = -1;
  weaponDragging = false;
  weaponDragTarget = null;
  wpnRenderSidebar();
  wpnDrawCanvas();
}

function wpnOnMouseMove(e) {
  const rect = weaponCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const dx = mx - weaponLastMouse.x;
  const dy = my - weaponLastMouse.y;
  weaponLastMouse = {x: mx, y: my};

  if (weaponIsPanning) {
    weaponPan.x += dx;
    weaponPan.y += dy;
    wpnDrawCanvas();
    return;
  }

  if (weaponDragging && weaponDragTarget === 'barrel' && weaponSelectedBarrel >= 0) {
    const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
    const offsets = weaponData[offsetsKey];
    if (!offsets) return;
    const coord = canvasToWpn(mx, my);
    offsets[weaponSelectedBarrel * 2] = +coord.x.toFixed(1);
    offsets[weaponSelectedBarrel * 2 + 1] = +coord.y.toFixed(1);
    wpnRenderSidebar();
    wpnDrawCanvas();
  }

  // Cursor
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const offsets = weaponData[offsetsKey] || [];
  const barrelCount = Math.floor(offsets.length / 2);
  let onBarrel = false;
  for (let i = 0; i < barrelCount; i++) {
    const p = wpnToCanvas(offsets[i * 2], offsets[i * 2 + 1]);
    if (Math.hypot(mx - p.x, my - p.y) < 14) { onBarrel = true; break; }
  }
  weaponCanvas.style.cursor = onBarrel ? 'grab' : (weaponDragging ? 'grabbing' : (weaponIsPanning ? 'move' : 'default'));
}

function wpnOnMouseUp(e) {
  weaponDragging = false;
  weaponDragTarget = null;
  weaponIsPanning = false;
}

function wpnOnWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  weaponScale *= factor;
  weaponScale = Math.max(0.1, Math.min(20, weaponScale));
  wpnDrawCanvas();
}

// ============= SIDEBAR =============
function wpnRenderSidebar() {
  if (!weaponData) return;
  const panel = document.getElementById('weaponSidebarPanel');
  let html = '';

  html += wpnBuildSection('基础属性', null, wpnBuildBasicProps(), true);
  html += wpnBuildSection('贴图', null, wpnBuildSpriteSection(), false);
  html += wpnBuildSection('发射点', wpnGetBarrelCount(), wpnBuildBarrelSection(), true);

  if (weaponData.specClass === 'projectile') {
    html += wpnBuildSection('动画', null, wpnBuildAnimSection(), false);
    html += wpnBuildSection('弹道', null, wpnBuildProjectileSection(), false);
  }

  if (weaponData.specClass === 'beam') {
    html += wpnBuildSection('光束', null, wpnBuildBeamSection(), false);
  }

  html += wpnBuildSection('音效', null, wpnBuildSoundSection(), false);

  panel.innerHTML = html;
}

function wpnBuildSection(title, badge, content, defaultOpen) {
  if (weaponSectionState[title] === undefined) weaponSectionState[title] = defaultOpen;
  const isOpen = weaponSectionState[title];
  const badgeHtml = badge !== null && badge !== undefined ? `<span class="badge">${badge}</span>` : '';
  return `<div class="sidebar-section${isOpen ? ' open' : ''}">
    <div class="sec-header" onclick="weaponSectionState['${title}']=!weaponSectionState['${title}'];this.parentElement.classList.toggle('open')">
      <span class="arrow">&#9654;</span>
      <span class="sec-title">${title}</span>
      ${badgeHtml}
    </div>
    <div class="sec-body">${content}</div>
  </div>`;
}

function wpnGetBarrelCount() {
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const offsets = weaponData[offsetsKey] || [];
  return Math.floor(offsets.length / 2);
}

// ============= BASIC PROPERTIES SECTION =============
function wpnBuildBasicProps() {
  const d = weaponData;
  return `<div class="prop-grid">
    <label>id</label><input value="${escHtml(d.id || '')}" readonly style="opacity:0.6">
    <label>specClass</label><select onchange="wpnPushUndo();weaponData.specClass=this.value;wpnRenderSidebar();wpnDrawCanvas()">
      ${['projectile', 'beam'].map(v => `<option${d.specClass === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>type</label><select onchange="wpnPushUndo();weaponData.type=this.value">
      ${['BALLISTIC', 'ENERGY', 'MISSILE', 'HYBRID', 'UNIVERSAL', 'SYNERGY', 'COMPOSITE', 'DECORATIVE', 'SYSTEM', 'BUILT_IN'].map(v => `<option${d.type === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>size</label><select onchange="wpnPushUndo();weaponData.size=this.value">
      ${['SMALL', 'MEDIUM', 'LARGE'].map(v => `<option${d.size === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
  </div>`;
}

// ============= SPRITE SECTION =============
function wpnBuildSpriteSection() {
  const d = weaponData;
  const fields = [
    ['turretSprite', '炮台贴图'],
    ['hardpointSprite', '固定贴图'],
    ['turretGunSprite', '炮台枪管'],
    ['hardpointGunSprite', '固定枪管'],
    ['turretGlowSprite', '炮台发光'],
    ['hardpointGlowSprite', '固定发光'],
    ['turretUnderSprite', '炮台底层'],
    ['hardpointUnderSprite', '固定底层']
  ];
  let html = '<div class="prop-grid">';
  fields.forEach(([key, label]) => {
    const val = d[key] || '';
    html += `<label>${label}</label>
    <div style="display:flex;gap:4px;align-items:center">
      <input style="flex:1;font-size:10px" value="${escHtml(val)}" onchange="wpnPushUndo();weaponData['${key}']=this.value;wpnReloadCurrentSprite()">
      <input type="file" id="wpnSprite_${key}" accept="image/png" style="display:none" onchange="wpnHandleSpriteUpload(this,'${key}')">
      <button class="tab-btn" onclick="document.getElementById('wpnSprite_${key}').click()" style="font-size:10px;padding:2px 6px;white-space:nowrap">...</button>
    </div>`;
  });
  html += '</div>';
  return html;
}

function wpnReloadCurrentSprite() {
  wpnLoadSprite(() => { wpnDrawCanvas(); });
}

async function wpnHandleSpriteUpload(input, fieldKey) {
  if (!input.files || !input.files[0] || !weaponData) return;
  const file = input.files[0];
  if (!file.name.toLowerCase().endsWith('.png')) {
    showToast('只支持 PNG 格式', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    const b64Full = reader.result;
    const b64Data = b64Full.split(',')[1];
    const filename = file.name;
    try {
      let resp = await fetch('/api/upload_sprite', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({filename, data: b64Data, overwrite: false, subfolder: 'weapons'})
      });
      let result = await resp.json();
      if (result.exists) {
        if (!confirm(result.message || `${filename} 已存在，是否覆盖？`)) { input.value = ''; return; }
        resp = await fetch('/api/upload_sprite', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({filename, data: b64Data, overwrite: true, subfolder: 'weapons'})
        });
        result = await resp.json();
      }
      if (result.ok) {
        wpnPushUndo();
        weaponData[fieldKey] = result.path;
        showToast(`贴图已保存: ${result.path}`, 'success');
        if (fieldKey === wpnGetSpriteField()) {
          weaponImg = new Image();
          weaponImg.src = b64Full;
          weaponImg.onload = () => { wpnRenderSidebar(); wpnDrawCanvas(); };
        } else {
          wpnRenderSidebar();
        }
      } else if (result.error) {
        showToast('上传失败: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('上传失败: ' + e.message, 'error');
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}

// ============= BARREL SECTION =============
function wpnBuildBarrelSection() {
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const anglesKey = weaponMode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
  if (!weaponData[offsetsKey]) weaponData[offsetsKey] = [];
  if (!weaponData[anglesKey]) weaponData[anglesKey] = [];
  const offsets = weaponData[offsetsKey];
  const angles = weaponData[anglesKey];
  const barrelCount = Math.floor(offsets.length / 2);

  let html = `<div style="margin-bottom:6px;font-size:11px;color:var(--text-dim)">当前视图: ${weaponMode === 'turret' ? '炮台' : '固定'} (${barrelCount} 个炮管)</div>`;

  // Barrel list
  html += '<div class="slot-list">';
  for (let i = 0; i < barrelCount; i++) {
    const sel = weaponSelectedBarrel === i ? ' selected' : '';
    html += `<div class="slot-item${sel}" onclick="weaponSelectedBarrel=${i};wpnRenderSidebar();wpnDrawCanvas()">
      <span class="dot" style="background:#ef4444"></span>
      <span>炮管 ${i}</span>
      <span style="color:var(--text-dim);font-size:10px">[${offsets[i*2]}, ${offsets[i*2+1]}] ${angles[i] || 0}°</span>
    </div>`;
  }
  html += '</div>';

  // Selected barrel details
  if (weaponSelectedBarrel >= 0 && weaponSelectedBarrel < barrelCount) {
    const idx = weaponSelectedBarrel;
    const ox = offsets[idx * 2];
    const oy = offsets[idx * 2 + 1];
    const ang = angles[idx] || 0;
    html += `<div class="prop-grid" style="margin-top:8px">
      <label>X (前进)</label><input type="number" step="0.5" value="${ox}" onchange="wpnPushUndo();weaponData['${offsetsKey}'][${idx*2}]=+this.value;wpnDrawCanvas()">
      <label>Y (右侧)</label><input type="number" step="0.5" value="${oy}" onchange="wpnPushUndo();weaponData['${offsetsKey}'][${idx*2+1}]=+this.value;wpnDrawCanvas()">
      <label>角度偏移</label><input type="number" step="1" value="${ang}" onchange="wpnPushUndo();weaponData['${anglesKey}'][${idx}]=+this.value;wpnDrawCanvas()">
    </div>`;
  }

  // barrelMode
  html += `<div class="prop-grid" style="margin-top:8px">
    <label>barrelMode</label><select onchange="wpnPushUndo();weaponData.barrelMode=this.value">
      ${['ALTERNATING', 'LINKED'].map(v => `<option${weaponData.barrelMode === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
  </div>`;

  // Actions
  html += `<div class="sec-actions">
    <button onclick="wpnAddBarrel()">+ 添加炮管</button>
    <button class="danger" onclick="wpnDeleteBarrel()">删除选中</button>
  </div>`;

  return html;
}

function wpnAddBarrel() {
  wpnPushUndo();
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const anglesKey = weaponMode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
  if (!weaponData[offsetsKey]) weaponData[offsetsKey] = [];
  if (!weaponData[anglesKey]) weaponData[anglesKey] = [];
  weaponData[offsetsKey].push(0, 0);
  weaponData[anglesKey].push(0);
  weaponSelectedBarrel = Math.floor(weaponData[offsetsKey].length / 2) - 1;
  wpnLog('wpnAddBarrel', weaponSelectedBarrel);
  wpnRenderSidebar();
  wpnDrawCanvas();
}

function wpnDeleteBarrel() {
  if (weaponSelectedBarrel < 0) return;
  wpnPushUndo();
  const offsetsKey = weaponMode === 'turret' ? 'turretOffsets' : 'hardpointOffsets';
  const anglesKey = weaponMode === 'turret' ? 'turretAngleOffsets' : 'hardpointAngleOffsets';
  const offsets = weaponData[offsetsKey] || [];
  const angles = weaponData[anglesKey] || [];
  const idx = weaponSelectedBarrel;
  if (idx * 2 < offsets.length) {
    offsets.splice(idx * 2, 2);
  }
  if (idx < angles.length) {
    angles.splice(idx, 1);
  }
  weaponSelectedBarrel = -1;
  wpnLog('wpnDeleteBarrel');
  wpnRenderSidebar();
  wpnDrawCanvas();
}

// ============= ANIMATION SECTION =============
function wpnBuildAnimSection() {
  const d = weaponData;
  let html = `<div class="prop-grid">
    <label>animationType</label><select onchange="wpnPushUndo();weaponData.animationType=this.value;wpnRenderSidebar()">
      ${['NONE', 'MUZZLE_FLASH', 'SMOKE', 'GLOW_AND_FLASH', 'GLOW'].map(v => `<option${(d.animationType || 'NONE') === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>visualRecoil</label><input type="number" step="1" value="${d.visualRecoil || 0}" onchange="wpnPushUndo();weaponData.visualRecoil=+this.value">
  </div>`;

  if (d.animationType === 'MUZZLE_FLASH' || d.animationType === 'GLOW_AND_FLASH') {
    const mf = d.muzzleFlashSpec || {};
    html += `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">muzzleFlashSpec</div>
    <div class="prop-grid" style="margin-top:4px">
      <label>length</label><input type="number" step="1" value="${mf.length || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.length=+this.value">
      <label>spread</label><input type="number" step="1" value="${mf.spread || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.spread=+this.value">
      <label>particleSizeMin</label><input type="number" step="1" value="${mf.particleSizeMin || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.particleSizeMin=+this.value">
      <label>particleSizeRange</label><input type="number" step="1" value="${mf.particleSizeRange || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.particleSizeRange=+this.value">
      <label>particleDuration</label><input type="number" step="0.01" value="${mf.particleDuration || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.particleDuration=+this.value">
      <label>particleCount</label><input type="number" step="1" value="${mf.particleCount || 0}" onchange="wpnPushUndo();if(!weaponData.muzzleFlashSpec)weaponData.muzzleFlashSpec={};weaponData.muzzleFlashSpec.particleCount=+this.value">
      <label>颜色 R</label><input type="number" min="0" max="255" value="${(mf.particleColor && mf.particleColor[0]) || 255}" onchange="wpnSetMuzzleColor(0,+this.value)">
      <label>颜色 G</label><input type="number" min="0" max="255" value="${(mf.particleColor && mf.particleColor[1]) || 200}" onchange="wpnSetMuzzleColor(1,+this.value)">
      <label>颜色 B</label><input type="number" min="0" max="255" value="${(mf.particleColor && mf.particleColor[2]) || 100}" onchange="wpnSetMuzzleColor(2,+this.value)">
      <label>颜色 A</label><input type="number" min="0" max="255" value="${(mf.particleColor && mf.particleColor[3]) || 255}" onchange="wpnSetMuzzleColor(3,+this.value)">
    </div>`;
  }

  if (d.animationType === 'SMOKE') {
    const sm = d.smokeSpec || {};
    html += `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">smokeSpec</div>
    <div class="prop-grid" style="margin-top:4px">
      <label>particleSizeMin</label><input type="number" step="1" value="${sm.particleSizeMin || 0}" onchange="wpnPushUndo();if(!weaponData.smokeSpec)weaponData.smokeSpec={};weaponData.smokeSpec.particleSizeMin=+this.value">
      <label>particleSizeRange</label><input type="number" step="1" value="${sm.particleSizeRange || 0}" onchange="wpnPushUndo();if(!weaponData.smokeSpec)weaponData.smokeSpec={};weaponData.smokeSpec.particleSizeRange=+this.value">
      <label>particleDuration</label><input type="number" step="0.01" value="${sm.particleDuration || 0}" onchange="wpnPushUndo();if(!weaponData.smokeSpec)weaponData.smokeSpec={};weaponData.smokeSpec.particleDuration=+this.value">
      <label>particleCount</label><input type="number" step="1" value="${sm.particleCount || 0}" onchange="wpnPushUndo();if(!weaponData.smokeSpec)weaponData.smokeSpec={};weaponData.smokeSpec.particleCount=+this.value">
      <label>spreadRate</label><input type="number" step="0.1" value="${sm.spreadRate || 0}" onchange="wpnPushUndo();if(!weaponData.smokeSpec)weaponData.smokeSpec={};weaponData.smokeSpec.spreadRate=+this.value">
      <label>颜色 R</label><input type="number" min="0" max="255" value="${(sm.particleColor && sm.particleColor[0]) || 100}" onchange="wpnSetSmokeColor(0,+this.value)">
      <label>颜色 G</label><input type="number" min="0" max="255" value="${(sm.particleColor && sm.particleColor[1]) || 100}" onchange="wpnSetSmokeColor(1,+this.value)">
      <label>颜色 B</label><input type="number" min="0" max="255" value="${(sm.particleColor && sm.particleColor[2]) || 100}" onchange="wpnSetSmokeColor(2,+this.value)">
      <label>颜色 A</label><input type="number" min="0" max="255" value="${(sm.particleColor && sm.particleColor[3]) || 200}" onchange="wpnSetSmokeColor(3,+this.value)">
    </div>`;
  }

  return html;
}

function wpnSetMuzzleColor(idx, val) {
  wpnPushUndo();
  if (!weaponData.muzzleFlashSpec) weaponData.muzzleFlashSpec = {};
  if (!weaponData.muzzleFlashSpec.particleColor) weaponData.muzzleFlashSpec.particleColor = [255, 200, 100, 255];
  weaponData.muzzleFlashSpec.particleColor[idx] = val;
}

function wpnSetSmokeColor(idx, val) {
  wpnPushUndo();
  if (!weaponData.smokeSpec) weaponData.smokeSpec = {};
  if (!weaponData.smokeSpec.particleColor) weaponData.smokeSpec.particleColor = [100, 100, 100, 200];
  weaponData.smokeSpec.particleColor[idx] = val;
}

// ============= PROJECTILE SECTION =============
function wpnBuildProjectileSection() {
  const d = weaponData;
  const projKeys = DATA.projFiles ? Object.keys(DATA.projFiles) : [];
  let html = `<div class="prop-grid">
    <label>projectileSpecId</label>
    <div style="position:relative">
      <input id="wpnProjSpecInput" value="${escHtml(d.projectileSpecId || '')}" oninput="wpnProjAutocomplete(this.value)" onchange="wpnPushUndo();weaponData.projectileSpecId=this.value">
      <div id="wpnProjSuggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:3px;max-height:150px;overflow-y:auto;display:none;z-index:10"></div>
    </div>
  </div>`;

  html += `<div class="sec-actions" style="margin-top:8px">
    <button onclick="wpnEditProjectile()">编辑弹道</button>
    <button onclick="wpnPreviewBallistic()">预览弹道</button>
  </div>`;

  return html;
}

function wpnProjAutocomplete(val) {
  const container = document.getElementById('wpnProjSuggestions');
  if (!container) return;
  if (!val || val.length < 1) { container.style.display = 'none'; return; }
  const projKeys = DATA.projFiles ? Object.keys(DATA.projFiles) : [];
  const matches = projKeys.filter(k => k.toLowerCase().includes(val.toLowerCase())).slice(0, 20);
  if (matches.length === 0) { container.style.display = 'none'; return; }
  container.innerHTML = matches.map(m =>
    `<div style="padding:3px 6px;font-size:11px;cursor:pointer;border-bottom:1px solid var(--border)" onmousedown="wpnSelectProj('${escHtml(m)}')">${escHtml(m)}</div>`
  ).join('');
  container.style.display = 'block';
}

function wpnSelectProj(projId) {
  wpnPushUndo();
  weaponData.projectileSpecId = projId;
  const input = document.getElementById('wpnProjSpecInput');
  if (input) input.value = projId;
  const container = document.getElementById('wpnProjSuggestions');
  if (container) container.style.display = 'none';
}

function wpnEditProjectile() {
  const projId = weaponData.projectileSpecId;
  if (!projId) { showToast('请先设置 projectileSpecId', 'error'); return; }
  openProjectileEditor(projId);
}

function wpnPreviewBallistic() {
  if (!weaponId) return;
  openBallisticPreview(weaponId);
}

// ============= BEAM SECTION =============
function wpnBuildBeamSection() {
  const d = weaponData;
  const fc = d.fringeColor || [255, 255, 255, 255];
  const cc = d.coreColor || [255, 255, 255, 255];
  const gc = d.glowColor || [255, 255, 255, 255];

  let html = `<div style="margin-bottom:6px;font-size:11px;font-weight:600;color:var(--accent)">fringeColor</div>
  <div class="prop-grid">
    <label>R</label><input type="number" min="0" max="255" value="${fc[0]}" onchange="wpnSetBeamColor('fringeColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${fc[1]}" onchange="wpnSetBeamColor('fringeColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${fc[2]}" onchange="wpnSetBeamColor('fringeColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${fc[3]}" onchange="wpnSetBeamColor('fringeColor',3,+this.value)">
  </div>
  <div style="margin-top:8px;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--accent)">coreColor</div>
  <div class="prop-grid">
    <label>R</label><input type="number" min="0" max="255" value="${cc[0]}" onchange="wpnSetBeamColor('coreColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${cc[1]}" onchange="wpnSetBeamColor('coreColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${cc[2]}" onchange="wpnSetBeamColor('coreColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${cc[3]}" onchange="wpnSetBeamColor('coreColor',3,+this.value)">
  </div>
  <div style="margin-top:8px;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--accent)">glowColor</div>
  <div class="prop-grid">
    <label>R</label><input type="number" min="0" max="255" value="${gc[0]}" onchange="wpnSetBeamColor('glowColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${gc[1]}" onchange="wpnSetBeamColor('glowColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${gc[2]}" onchange="wpnSetBeamColor('glowColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${gc[3]}" onchange="wpnSetBeamColor('glowColor',3,+this.value)">
  </div>`;

  html += `<div class="prop-grid" style="margin-top:8px">
    <label>width</label><input type="number" step="1" value="${d.width || 0}" onchange="wpnPushUndo();weaponData.width=+this.value">
    <label>textureType</label><select onchange="wpnPushUndo();weaponData.textureType=this.value">
      ${['ROUGH', 'SMOOTH', 'NONE'].map(v => `<option${(d.textureType || 'ROUGH') === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>textureScrollSpeed</label><input type="number" step="10" value="${d.textureScrollSpeed || 0}" onchange="wpnPushUndo();weaponData.textureScrollSpeed=+this.value">
    <label>pixelsPerTexel</label><input type="number" step="0.1" value="${d.pixelsPerTexel || 1}" onchange="wpnPushUndo();weaponData.pixelsPerTexel=+this.value">
    <label>convergeOnPoint</label><input type="checkbox" ${d.convergeOnPoint ? 'checked' : ''} onchange="wpnPushUndo();weaponData.convergeOnPoint=this.checked" style="width:auto">
    <label>darkCore</label><input type="checkbox" ${d.darkCore ? 'checked' : ''} onchange="wpnPushUndo();weaponData.darkCore=this.checked" style="width:auto">
  </div>`;

  // pierceSet
  const pierceOptions = ['FIGHTER', 'MISSILE', 'PROJECTILE'];
  const currentPierce = d.pierceSet || [];
  html += `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">pierceSet</div>
  <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">`;
  pierceOptions.forEach(opt => {
    const checked = currentPierce.includes(opt) ? 'checked' : '';
    html += `<label style="font-size:11px;display:flex;align-items:center;gap:3px;cursor:pointer">
      <input type="checkbox" ${checked} onchange="wpnTogglePierce('${opt}',this.checked)" style="width:auto">${opt}
    </label>`;
  });
  html += '</div>';

  // Preview ballistic button for beam weapons
  html += `<div class="sec-actions" style="margin-top:8px">
    <button onclick="wpnPreviewBallistic()">预览光束</button>
  </div>`;

  return html;
}

function wpnSetBeamColor(field, idx, val) {
  wpnPushUndo();
  if (!weaponData[field]) weaponData[field] = [255, 255, 255, 255];
  weaponData[field][idx] = val;
}

function wpnTogglePierce(opt, checked) {
  wpnPushUndo();
  if (!weaponData.pierceSet) weaponData.pierceSet = [];
  if (checked) {
    if (!weaponData.pierceSet.includes(opt)) weaponData.pierceSet.push(opt);
  } else {
    weaponData.pierceSet = weaponData.pierceSet.filter(v => v !== opt);
  }
}

// ============= SOUND SECTION =============
function wpnBuildSoundSection() {
  const d = weaponData;
  return `<div class="prop-grid">
    <label>fireSoundOne</label><input value="${escHtml(d.fireSoundOne || '')}" onchange="wpnPushUndo();weaponData.fireSoundOne=this.value">
    <label>fireSoundTwo</label><input value="${escHtml(d.fireSoundTwo || '')}" onchange="wpnPushUndo();weaponData.fireSoundTwo=this.value">
  </div>`;
}

// ============= SAVE =============
async function saveWeaponFile() {
  if (!weaponData || !weaponId) return;
  try {
    const resp = await fetch('/api/save_wpn', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: weaponId, data: weaponData})
    });
    if (!resp.ok) throw new Error('Save failed: ' + resp.status);
    DATA.wpnFiles[weaponId] = JSON.parse(JSON.stringify(weaponData));
    showToast(`已保存 ${weaponId}.wpn`, 'success');
  } catch (e) {
    showToast(`保存失败: ${e.message}`, 'error');
  }
}

// ============= WINDOW RESIZE =============
window.addEventListener('resize', () => {
  if (weaponCanvas && document.getElementById('weaponEditorModal').classList.contains('show')) {
    const panel = document.getElementById('weaponCanvasPanel');
    const rect = panel.getBoundingClientRect();
    weaponCanvas.width = rect.width;
    weaponCanvas.height = rect.height;
    wpnDrawCanvas();
  }
});
