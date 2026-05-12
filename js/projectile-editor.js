// ============= PROJECTILE EDITOR STATE =============
let projData = null;
let projId = null;
let projSectionState = {};

// ============= OPEN / CLOSE =============
function openProjectileEditor(id) {
  if (!id) { showToast('未指定弹道ID', 'error'); return; }

  // Try local cache first, then fetch
  if (DATA.projFiles && DATA.projFiles[id]) {
    projId = id;
    projData = JSON.parse(JSON.stringify(DATA.projFiles[id]));
    projShowModal();
  } else {
    fetch('/api/proj/' + encodeURIComponent(id))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        projId = id;
        projData = data;
        if (!DATA.projFiles) DATA.projFiles = {};
        DATA.projFiles[id] = JSON.parse(JSON.stringify(data));
        projShowModal();
      })
      .catch(e => { showToast('加载弹道失败: ' + e.message, 'error'); });
  }
}

function projShowModal() {
  projSectionState = {'基础属性': true};
  document.getElementById('projEditorTitle').textContent = '编辑弹道: ' + (projId || '');
  document.getElementById('projectileEditorModal').classList.add('show');
  projRenderForm();
}

function closeProjectileEditor() {
  document.getElementById('projectileEditorModal').classList.remove('show');
  projData = null;
  projId = null;
}

// ============= RENDER FORM =============
function projRenderForm() {
  if (!projData) return;
  const panel = document.getElementById('projEditorPanel');
  let html = '';

  const specClass = projData.specClass || 'projectile';

  if (specClass === 'projectile') {
    html += projBuildSection('基础属性', null, projBuildBulletBasic(), true);
    html += projBuildSection('外观', null, projBuildBulletVisual(), false);
    html += projBuildSection('碰撞与消散', null, projBuildBulletCollision(), false);
  } else if (specClass === 'missile') {
    html += projBuildSection('基础属性', null, projBuildMissileBasic(), true);
    html += projBuildSection('外观', null, projBuildMissileVisual(), false);
    html += projBuildSection('引擎参数', null, projBuildMissileEngine(), false);
    html += projBuildSection('引擎槽位', projGetEngineSlotCount(), projBuildMissileEngineSlots(), false);
    html += projBuildSection('爆炸', null, projBuildMissileExplosion(), false);
    html += projBuildSection('时间参数', null, projBuildMissileTiming(), false);
  } else {
    html += projBuildSection('基础属性', null, projBuildGenericProps(), true);
  }

  panel.innerHTML = html;
}

function projBuildSection(title, badge, content, defaultOpen) {
  if (projSectionState[title] === undefined) projSectionState[title] = defaultOpen;
  const isOpen = projSectionState[title];
  const badgeHtml = badge !== null && badge !== undefined ? `<span class="badge">${badge}</span>` : '';
  return `<div class="sidebar-section${isOpen ? ' open' : ''}">
    <div class="sec-header" onclick="projSectionState['${title}']=!projSectionState['${title}'];this.parentElement.classList.toggle('open')">
      <span class="arrow">&#9654;</span>
      <span class="sec-title">${title}</span>
      ${badgeHtml}
    </div>
    <div class="sec-body">${content}</div>
  </div>`;
}

// ============= BULLET (specClass=projectile) =============
function projBuildBulletBasic() {
  const d = projData;
  return `<div class="prop-grid">
    <label>id</label><input value="${escHtml(d.id || '')}" readonly style="opacity:0.6">
    <label>specClass</label><select onchange="projData.specClass=this.value;projRenderForm()">
      ${['projectile', 'missile'].map(v => `<option${d.specClass === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>spawnType</label><select onchange="projData.spawnType=this.value">
      ${['BALLISTIC', 'BALLISTIC_AS_BEAM', 'ENERGY'].map(v => `<option${(d.spawnType || 'BALLISTIC') === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
  </div>`;
}

function projBuildBulletVisual() {
  const d = projData;
  const fc = d.fringeColor || [255, 255, 255, 255];
  const cc = d.coreColor || [255, 255, 255, 255];
  let html = `<div class="prop-grid">
    <label>bulletSprite</label>
    <div style="display:flex;gap:4px;align-items:center">
      <input style="flex:1;font-size:10px" value="${escHtml(d.bulletSprite || '')}" onchange="projData.bulletSprite=this.value">
      <input type="file" id="projBulletSprite" accept="image/png" style="display:none" onchange="projHandleSpriteUpload(this,'bulletSprite')">
      <button class="tab-btn" onclick="document.getElementById('projBulletSprite').click()" style="font-size:10px;padding:2px 6px">...</button>
    </div>
    <label>length</label><input type="number" step="1" value="${d.length || 0}" onchange="projData.length=+this.value">
    <label>width</label><input type="number" step="1" value="${d.width || 0}" onchange="projData.width=+this.value">
    <label>textureScrollSpeed</label><input type="number" step="10" value="${d.textureScrollSpeed || 0}" onchange="projData.textureScrollSpeed=+this.value">
    <label>pixelsPerTexel</label><input type="number" step="0.1" value="${d.pixelsPerTexel || 1}" onchange="projData.pixelsPerTexel=+this.value">
  </div>`;

  html += `<div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">fringeColor [R,G,B,A]</div>
  <div class="prop-grid" style="margin-top:4px">
    <label>R</label><input type="number" min="0" max="255" value="${fc[0]}" onchange="projSetColor('fringeColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${fc[1]}" onchange="projSetColor('fringeColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${fc[2]}" onchange="projSetColor('fringeColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${fc[3]}" onchange="projSetColor('fringeColor',3,+this.value)">
  </div>
  <div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">coreColor [R,G,B,A]</div>
  <div class="prop-grid" style="margin-top:4px">
    <label>R</label><input type="number" min="0" max="255" value="${cc[0]}" onchange="projSetColor('coreColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${cc[1]}" onchange="projSetColor('coreColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${cc[2]}" onchange="projSetColor('coreColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${cc[3]}" onchange="projSetColor('coreColor',3,+this.value)">
  </div>`;

  return html;
}

function projBuildBulletCollision() {
  const d = projData;
  return `<div class="prop-grid">
    <label>collisionClass</label><select onchange="projData.collisionClass=this.value">
      ${['PROJECTILE_NO_FF', 'PROJECTILE_FF', 'PROJECTILE_FIGHTER', 'MISSILE_NO_FF', 'MISSILE_FF', 'RAY', 'RAY_FIGHTER', 'HITS_SHIPS_AND_ASTEROIDS', 'NONE'].map(v => `<option${(d.collisionClass || 'PROJECTILE_NO_FF') === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>collisionClassByFighter</label><select onchange="projData.collisionClassByFighter=this.value">
      ${['', 'PROJECTILE_NO_FF', 'PROJECTILE_FF', 'PROJECTILE_FIGHTER', 'MISSILE_NO_FF', 'RAY_FIGHTER', 'NONE'].map(v => `<option${(d.collisionClassByFighter || '') === v ? ' selected' : ''}>${v || '(无)'}</option>`).join('')}
    </select>
    <label>fadeTime</label><input type="number" step="0.01" value="${d.fadeTime || 0}" onchange="projData.fadeTime=+this.value">
    <label>hitGlowRadius</label><input type="number" step="1" value="${d.hitGlowRadius || 0}" onchange="projData.hitGlowRadius=+this.value">
  </div>`;
}

// ============= MISSILE (specClass=missile) =============
function projBuildMissileBasic() {
  const d = projData;
  return `<div class="prop-grid">
    <label>id</label><input value="${escHtml(d.id || '')}" readonly style="opacity:0.6">
    <label>specClass</label><select onchange="projData.specClass=this.value;projRenderForm()">
      ${['projectile', 'missile'].map(v => `<option${d.specClass === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
    <label>missileType</label><select onchange="projData.missileType=this.value">
      ${['MISSILE', 'ROCKET', 'MIRV', 'PHASE'].map(v => `<option${(d.missileType || 'MISSILE') === v ? ' selected' : ''}>${v}</option>`).join('')}
    </select>
  </div>`;
}

function projBuildMissileVisual() {
  const d = projData;
  const size = d.size || [0, 0];
  const center = d.center || [0, 0];
  const ec = d.explosionColor || [255, 200, 50, 255];
  return `<div class="prop-grid">
    <label>sprite</label>
    <div style="display:flex;gap:4px;align-items:center">
      <input style="flex:1;font-size:10px" value="${escHtml(d.sprite || '')}" onchange="projData.sprite=this.value">
      <input type="file" id="projMissileSprite" accept="image/png" style="display:none" onchange="projHandleSpriteUpload(this,'sprite')">
      <button class="tab-btn" onclick="document.getElementById('projMissileSprite').click()" style="font-size:10px;padding:2px 6px">...</button>
    </div>
    <label>size W</label><input type="number" step="1" value="${size[0]}" onchange="if(!projData.size)projData.size=[0,0];projData.size[0]=+this.value">
    <label>size H</label><input type="number" step="1" value="${size[1]}" onchange="if(!projData.size)projData.size=[0,0];projData.size[1]=+this.value">
    <label>center X</label><input type="number" step="0.5" value="${center[0]}" onchange="if(!projData.center)projData.center=[0,0];projData.center[0]=+this.value">
    <label>center Y</label><input type="number" step="0.5" value="${center[1]}" onchange="if(!projData.center)projData.center=[0,0];projData.center[1]=+this.value">
    <label>collisionRadius</label><input type="number" step="1" value="${d.collisionRadius || 0}" onchange="projData.collisionRadius=+this.value">
  </div>
  <div style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent)">explosionColor [R,G,B,A]</div>
  <div class="prop-grid" style="margin-top:4px">
    <label>R</label><input type="number" min="0" max="255" value="${ec[0]}" onchange="projSetColor('explosionColor',0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${ec[1]}" onchange="projSetColor('explosionColor',1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${ec[2]}" onchange="projSetColor('explosionColor',2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${ec[3]}" onchange="projSetColor('explosionColor',3,+this.value)">
  </div>`;
}

function projBuildMissileEngine() {
  const d = projData;
  const eng = d.engineSpec || {};
  return `<div class="prop-grid">
    <label>turnAcc</label><input type="number" step="10" value="${eng.turnAcc || 0}" onchange="if(!projData.engineSpec)projData.engineSpec={};projData.engineSpec.turnAcc=+this.value">
    <label>turnRate</label><input type="number" step="10" value="${eng.turnRate || 0}" onchange="if(!projData.engineSpec)projData.engineSpec={};projData.engineSpec.turnRate=+this.value">
    <label>acc</label><input type="number" step="10" value="${eng.acc || 0}" onchange="if(!projData.engineSpec)projData.engineSpec={};projData.engineSpec.acc=+this.value">
    <label>dec</label><input type="number" step="10" value="${eng.dec || 0}" onchange="if(!projData.engineSpec)projData.engineSpec={};projData.engineSpec.dec=+this.value">
    <label>maxSpeed</label><input type="number" step="10" value="${eng.maxSpeed || 0}" onchange="if(!projData.engineSpec)projData.engineSpec={};projData.engineSpec.maxSpeed=+this.value">
  </div>`;
}

function projGetEngineSlotCount() {
  return (projData.engineSlots || []).length;
}

function projBuildMissileEngineSlots() {
  if (!projData.engineSlots) projData.engineSlots = [];
  const slots = projData.engineSlots;
  let html = '<div class="slot-list">';
  slots.forEach((slot, i) => {
    html += `<div class="slot-item" onclick="projSelectEngineSlot(${i})">
      <span class="dot" style="background:#f59e0b"></span>
      <span>引擎 ${i}</span>
      <span style="color:var(--text-dim);font-size:10px">${slot.style || 'CUSTOM'}</span>
    </div>`;
  });
  html += '</div>';

  // Details for each slot
  slots.forEach((slot, i) => {
    const loc = slot.loc || [0, 0];
    html += `<div class="prop-grid" style="margin-top:6px;padding:6px;background:#0f172a;border-radius:4px">
      <label style="grid-column:1/-1;font-weight:600;color:var(--accent);font-size:11px">引擎 ${i}</label>
      <label>loc X</label><input type="number" step="0.5" value="${loc[0]}" onchange="projData.engineSlots[${i}].loc[0]=+this.value">
      <label>loc Y</label><input type="number" step="0.5" value="${loc[1]}" onchange="projData.engineSlots[${i}].loc[1]=+this.value">
      <label>angle</label><input type="number" step="1" value="${slot.angle || 0}" onchange="projData.engineSlots[${i}].angle=+this.value">
      <label>width</label><input type="number" step="0.5" value="${slot.width || 0}" onchange="projData.engineSlots[${i}].width=+this.value">
      <label>length</label><input type="number" step="0.5" value="${slot.length || 0}" onchange="projData.engineSlots[${i}].length=+this.value">
      <label>style</label><select onchange="projData.engineSlots[${i}].style=this.value">
        ${['LOW_TECH', 'MIDLINE', 'HIGH_TECH', 'CUSTOM', 'COBRA_BOMBER'].map(v => `<option${(slot.style || 'CUSTOM') === v ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
      <label></label><button class="tab-btn" onclick="projDeleteEngineSlot(${i})" style="font-size:10px;padding:2px 8px;border-color:var(--error);color:var(--error)">删除</button>
    </div>`;
  });

  html += `<div class="sec-actions">
    <button onclick="projAddEngineSlot()">+ 添加引擎槽</button>
  </div>`;
  return html;
}

function projSelectEngineSlot(idx) {
  // Scroll to the slot details (visual feedback only)
}

function projAddEngineSlot() {
  if (!projData.engineSlots) projData.engineSlots = [];
  projData.engineSlots.push({
    loc: [0, 0],
    angle: 180,
    width: 8,
    length: 20,
    style: 'CUSTOM'
  });
  projRenderForm();
}

function projDeleteEngineSlot(idx) {
  if (!projData.engineSlots) return;
  projData.engineSlots.splice(idx, 1);
  projRenderForm();
}

function projBuildMissileExplosion() {
  const d = projData;
  const exp = d.explosionSpec || {};
  const ec = exp.particleColor || [255, 200, 50, 255];
  return `<div class="prop-grid">
    <label>explosionRadius</label><input type="number" step="10" value="${d.explosionRadius || 0}" onchange="projData.explosionRadius=+this.value">
    <label>duration</label><input type="number" step="0.1" value="${exp.duration || 0}" onchange="if(!projData.explosionSpec)projData.explosionSpec={};projData.explosionSpec.duration=+this.value">
    <label>radius</label><input type="number" step="10" value="${exp.radius || 0}" onchange="if(!projData.explosionSpec)projData.explosionSpec={};projData.explosionSpec.radius=+this.value">
    <label>coreRadius</label><input type="number" step="5" value="${exp.coreRadius || 0}" onchange="if(!projData.explosionSpec)projData.explosionSpec={};projData.explosionSpec.coreRadius=+this.value">
    <label>particleCount</label><input type="number" step="5" value="${exp.particleCount || 0}" onchange="if(!projData.explosionSpec)projData.explosionSpec={};projData.explosionSpec.particleCount=+this.value">
  </div>
  <div style="margin-top:6px;font-size:11px;font-weight:600;color:var(--accent)">particleColor [R,G,B,A]</div>
  <div class="prop-grid" style="margin-top:4px">
    <label>R</label><input type="number" min="0" max="255" value="${ec[0]}" onchange="projSetExpColor(0,+this.value)">
    <label>G</label><input type="number" min="0" max="255" value="${ec[1]}" onchange="projSetExpColor(1,+this.value)">
    <label>B</label><input type="number" min="0" max="255" value="${ec[2]}" onchange="projSetExpColor(2,+this.value)">
    <label>A</label><input type="number" min="0" max="255" value="${ec[3]}" onchange="projSetExpColor(3,+this.value)">
  </div>`;
}

function projBuildMissileTiming() {
  const d = projData;
  return `<div class="prop-grid">
    <label>flameoutTime</label><input type="number" step="0.1" value="${d.flameoutTime || 0}" onchange="projData.flameoutTime=+this.value">
    <label>armingTime</label><input type="number" step="0.1" value="${d.armingTime || 0}" onchange="projData.armingTime=+this.value">
    <label>fadeTime</label><input type="number" step="0.1" value="${d.fadeTime || 0}" onchange="projData.fadeTime=+this.value">
  </div>`;
}

// ============= GENERIC PROPS =============
function projBuildGenericProps() {
  const d = projData;
  let html = '<div class="prop-grid">';
  const skipKeys = new Set(['id', 'specClass']);
  Object.keys(d).forEach(key => {
    if (skipKeys.has(key)) return;
    const val = d[key];
    if (typeof val === 'object') return; // Skip complex objects
    html += `<label>${escHtml(key)}</label><input value="${escHtml(String(val || ''))}" onchange="projData['${escHtml(key)}']=this.value">`;
  });
  html += '</div>';
  return html;
}

// ============= COLOR HELPERS =============
function projSetColor(field, idx, val) {
  if (!projData[field]) projData[field] = [255, 255, 255, 255];
  projData[field][idx] = val;
}

function projSetExpColor(idx, val) {
  if (!projData.explosionSpec) projData.explosionSpec = {};
  if (!projData.explosionSpec.particleColor) projData.explosionSpec.particleColor = [255, 200, 50, 255];
  projData.explosionSpec.particleColor[idx] = val;
}

// ============= SPRITE UPLOAD =============
async function projHandleSpriteUpload(input, fieldKey) {
  if (!input.files || !input.files[0] || !projData) return;
  const file = input.files[0];
  if (!file.name.toLowerCase().endsWith('.png')) {
    showToast('只支持 PNG 格式', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    const b64Data = reader.result.split(',')[1];
    const filename = file.name;
    try {
      let resp = await fetch('/api/upload_sprite', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({filename, data: b64Data, overwrite: false, subfolder: 'missiles'})
      });
      let result = await resp.json();
      if (result.exists) {
        if (!confirm(result.message || `${filename} 已存在，是否覆盖？`)) { input.value = ''; return; }
        resp = await fetch('/api/upload_sprite', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({filename, data: b64Data, overwrite: true, subfolder: 'missiles'})
        });
        result = await resp.json();
      }
      if (result.ok) {
        projData[fieldKey] = result.path;
        showToast(`贴图已保存: ${result.path}`, 'success');
        projRenderForm();
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

// ============= SAVE =============
async function saveProjectileFile() {
  if (!projData || !projId) return;
  try {
    const resp = await fetch('/api/save_proj', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: projId, data: projData})
    });
    if (!resp.ok) throw new Error('Save failed: ' + resp.status);
    if (!DATA.projFiles) DATA.projFiles = {};
    DATA.projFiles[projId] = JSON.parse(JSON.stringify(projData));
    showToast(`已保存 ${projId}.proj`, 'success');
  } catch (e) {
    showToast(`保存失败: ${e.message}`, 'error');
  }
}
