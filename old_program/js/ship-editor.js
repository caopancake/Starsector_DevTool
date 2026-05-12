// ============= SHIP EDITOR STATE =============
let editorShip = null;
let editorHullId = null;
let editorMode = 'weapon';
let editorSelectedIdx = -1;
let editorCanvas = null;
let editorCtx = null;
let editorImg = null;
let editorScale = 1;
let editorOffset = {x: 0, y: 0};
let editorDragging = false;
let editorDragTarget = null;
let editorPan = {x: 0, y: 0};
let editorLastMouse = {x: 0, y: 0};
let editorIsPanning = false;
let sectionOpenState = {};

const UNDO_LIMIT = 250;
let undoStack = [];
let redoStack = [];

let editorResizing = false;
let editorResizeHandle = null;

// ============= DEBUG LOG =============
const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log('[ShipEditor]', ...args);
}

// ============= UNDO / REDO =============
function pushUndo() {
  if (!editorShip) return;
  undoStack.push(JSON.stringify(editorShip));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  redoStack = [];
}

function editorUndo() {
  if (!editorShip || undoStack.length === 0) return;
  redoStack.push(JSON.stringify(editorShip));
  editorShip = JSON.parse(undoStack.pop());
  editorSelectedIdx = -1;
  renderSidebar(); drawCanvas();
  showToast('撤销', 'success');
}

function editorRedo() {
  if (!editorShip || redoStack.length === 0) return;
  undoStack.push(JSON.stringify(editorShip));
  editorShip = JSON.parse(redoStack.pop());
  editorSelectedIdx = -1;
  renderSidebar(); drawCanvas();
  showToast('重做', 'success');
}

document.addEventListener('keydown', e => {
  if (!editorShip) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editorUndo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); editorRedo(); }
});

// ============= OPEN / CLOSE =============
function openShipEditor(hullId) {
  if (!DATA.shipFiles || !DATA.shipFiles[hullId]) {
    showToast('无法找到 ' + hullId + ' 的.ship数据', 'error');
    return;
  }
  editorHullId = hullId;
  editorShip = JSON.parse(JSON.stringify(DATA.shipFiles[hullId]));
  editorMode = 'weapon';
  editorSelectedIdx = -1;
  editorScale = 1;
  editorPan = {x: 0, y: 0};
  sectionOpenState = {'船体属性': true, '武器插槽': true, '护盾发生器': true, '质量中心': true};
  undoStack = []; redoStack = [];

  dlog('openShipEditor', hullId, 'center:', editorShip.center, 'shieldCenter:', editorShip.shieldCenter, 'shieldRadius:', editorShip.shieldRadius);

  document.getElementById('editorTitle').textContent = '编辑: ' + (editorShip.hullName || hullId);
  document.getElementById('shipEditorModal').classList.add('show');
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'weapon'));

  editorImg = new Image();
  if (DATA.shipSprites && DATA.shipSprites[hullId]) {
    editorImg.src = DATA.shipSprites[hullId];
  }
  editorImg.onload = () => { initCanvas(); renderSidebar(); drawCanvas(); };
  editorImg.onerror = () => { initCanvas(); renderSidebar(); drawCanvas(); };
  setTimeout(() => { if (!editorCanvas) { initCanvas(); renderSidebar(); drawCanvas(); } }, 100);
}

function closeShipEditor() {
  document.getElementById('shipEditorModal').classList.remove('show');
  editorShip = null;
  editorHullId = null;
}

function setEditorMode(mode) {
  editorMode = mode;
  editorSelectedIdx = -1;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const modeToSection = {weapon:'武器插槽', engine:'引擎', bounds:'碰撞边界', props:'船体属性'};
  if (modeToSection[mode]) sectionOpenState[modeToSection[mode]] = true;
  dlog('setEditorMode', mode);
  renderSidebar(); drawCanvas();
}

// ============= CANVAS INIT =============
function initCanvas() {
  const panel = document.getElementById('canvasPanel');
  editorCanvas = document.getElementById('shipCanvas');
  editorCtx = editorCanvas.getContext('2d');

  const rect = panel.getBoundingClientRect();
  editorCanvas.width = rect.width;
  editorCanvas.height = rect.height;

  if (editorImg && editorImg.width) {
    const sw = (rect.width * 0.6) / editorImg.width;
    const sh = (rect.height * 0.6) / editorImg.height;
    editorScale = Math.min(sw, sh);
  } else {
    editorScale = 1;
  }
  editorPan = {x: 0, y: 0};

  editorCanvas.onmousedown = onCanvasMouseDown;
  editorCanvas.onmousemove = onCanvasMouseMove;
  editorCanvas.onmouseup = onCanvasMouseUp;
  editorCanvas.onwheel = onCanvasWheel;
  editorCanvas.oncontextmenu = e => e.preventDefault();
  dlog('initCanvas', 'size:', editorCanvas.width, 'x', editorCanvas.height, 'scale:', editorScale.toFixed(3));
}

function getCanvasCenter() {
  if (!editorCanvas) return {x: 0, y: 0};
  return {
    x: editorCanvas.width / 2 + editorPan.x,
    y: editorCanvas.height / 2 + editorPan.y
  };
}

function shipToCanvas(loc) {
  const cc = getCanvasCenter();
  return {
    x: cc.x - loc[1] * editorScale,
    y: cc.y - loc[0] * editorScale
  };
}

function canvasToShip(px, py) {
  const cc = getCanvasCenter();
  return [
    -(py - cc.y) / editorScale,
    -(px - cc.x) / editorScale
  ];
}

// ============= DRAWING =============
function drawCanvas() {
  if (!editorCtx || !editorCanvas) return;
  const ctx = editorCtx;
  const w = editorCanvas.width, h = editorCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const cc = getCanvasCenter();

  // Sprite
  if (editorImg && editorImg.width) {
    const center = editorShip.center || [0, 0];
    const imgW = editorImg.width * editorScale;
    const imgH = editorImg.height * editorScale;
    const drawX = cc.x - center[0] * editorScale;
    const drawY = cc.y - center[1] * editorScale;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(editorImg, drawX, drawY, imgW, imgH);
    ctx.globalAlpha = 1.0;
  }

  // Collision bounds
  if (editorShip.bounds && editorShip.bounds.length >= 4 && (editorMode === 'bounds' || editorMode === 'props')) {
    ctx.beginPath();
    const bounds = editorShip.bounds;
    for (let i = 0; i < bounds.length; i += 2) {
      const p = shipToCanvas([bounds[i], bounds[i+1]]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = editorMode === 'bounds' ? '#22c55e' : '#22c55e66';
    ctx.lineWidth = editorMode === 'bounds' ? 1.5 : 1;
    ctx.stroke();
    if (editorMode === 'bounds') {
      for (let i = 0; i < bounds.length; i += 2) {
        const p = shipToCanvas([bounds[i], bounds[i+1]]);
        const idx = i / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, idx === editorSelectedIdx ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === editorSelectedIdx ? '#fff' : '#22c55e';
        ctx.fill();
      }
    }
  }

  // Shield (props mode)
  if (editorShip.shieldRadius && editorMode === 'props') {
    const sc = editorShip.shieldCenter || [0, 0];
    const sp = shipToCanvas(sc);
    const sr = editorShip.shieldRadius * editorScale;
    // Shield circle
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sr, 0, Math.PI * 2);
    ctx.strokeStyle = '#06b6d4aa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Shield center dot (large, easy to click)
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Label
    ctx.fillStyle = '#06b6d4';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('护盾中心', sp.x, sp.y - 14);
  }

  // Center crosshair (props mode) - large, easy to click
  if (editorMode === 'props') {
    const crossSize = 16;
    ctx.beginPath();
    ctx.moveTo(cc.x - crossSize, cc.y); ctx.lineTo(cc.x + crossSize, cc.y);
    ctx.moveTo(cc.x, cc.y - crossSize); ctx.lineTo(cc.x, cc.y + crossSize);
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Outer ring for easier clicking
    ctx.beginPath();
    ctx.arc(cc.x, cc.y, 10, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('质量中心', cc.x, cc.y - 18);
  }

  // Weapon slots
  if (editorShip.weaponSlots && (editorMode === 'weapon' || editorMode === 'props')) {
    editorShip.weaponSlots.forEach((slot, idx) => {
      const loc = slot.locations || [0, 0];
      const p = shipToCanvas(loc);
      const color = WEAPON_COLORS[slot.type] || '#888';
      const r = (SLOT_RADIUS[slot.size] || 6) * (editorScale > 0.5 ? 1 : editorScale * 2);
      const isSelected = editorMode === 'weapon' && editorSelectedIdx === idx;

      if (slot.arc && slot.arc > 0) {
        const baseAngle = -Math.PI/2 + (slot.angle || 0) * Math.PI / 180;
        const halfArc = (slot.arc / 2) * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, r * 2.5, baseAngle - halfArc, baseAngle + halfArc);
        ctx.closePath();
        ctx.fillStyle = color + '22'; ctx.fill();
        ctx.strokeStyle = color + '66'; ctx.lineWidth = 0.5; ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#fff' : color;
      ctx.globalAlpha = isSelected ? 1.0 : 0.8;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      if (isSelected) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
    });
  }

  // Engine slots
  if (editorShip.engineSlots && (editorMode === 'engine' || editorMode === 'props')) {
    editorShip.engineSlots.forEach((eng, idx) => {
      const p = shipToCanvas(eng.location || [0, 0]);
      const isSelected = editorMode === 'engine' && editorSelectedIdx === idx;
      const ew = (eng.width || 10) * editorScale;
      const el = (eng.length || 20) * editorScale;
      const engAngleRad = -Math.PI/2 + (eng.angle || 0) * Math.PI / 180;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(engAngleRad);
      ctx.fillStyle = isSelected ? '#fbbf24' : '#f59e0b88';
      ctx.strokeStyle = isSelected ? '#fff' : '#f59e0b';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(0, -ew/2, el, ew);
      ctx.strokeRect(0, -ew/2, el, ew);
      ctx.restore();
    });
  }

  // Selection boxes and resize handles
  drawSelectionUI(ctx);
}

function drawSelectionUI(ctx) {
  // Weapon selection box
  if (editorMode === 'weapon' && editorSelectedIdx >= 0 && editorShip.weaponSlots && editorShip.weaponSlots[editorSelectedIdx]) {
    const slot = editorShip.weaponSlots[editorSelectedIdx];
    const p = shipToCanvas(slot.locations || [0,0]);
    const r = (SLOT_RADIUS[slot.size] || 6) + 6;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#f39900'; ctx.lineWidth = 1;
    ctx.strokeRect(p.x - r, p.y - r, r*2, r*2);
    ctx.setLineDash([]);
  }
  // Engine selection box
  if (editorMode === 'engine' && editorSelectedIdx >= 0 && editorShip.engineSlots && editorShip.engineSlots[editorSelectedIdx]) {
    const eng = editorShip.engineSlots[editorSelectedIdx];
    const p = shipToCanvas(eng.location || [0,0]);
    const ew2 = (eng.width||10)*editorScale/2 + 4;
    const el2 = (eng.length||20)*editorScale + 4;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#f39900'; ctx.lineWidth = 1;
    ctx.strokeRect(p.x - ew2, p.y - el2, ew2*2, el2 + ew2);
    ctx.setLineDash([]);
  }
  // Resize handles
  const handles = getResizeHandles();
  handles.forEach(h => {
    ctx.beginPath();
    ctx.rect(h.x - 5, h.y - 5, 10, 10);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#f39900';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawGrid(ctx, w, h) {
  const step = 50 * editorScale;
  if (step < 5) return;
  ctx.strokeStyle = '#1e293b44'; ctx.lineWidth = 0.5;
  const cc = getCanvasCenter();
  const offX = cc.x % step, offY = cc.y % step;
  for (let x = offX; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = offY; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// ============= HIT TESTING =============
const HIT_RADIUS = 14; // generous click radius for all interactive elements

function getResizeHandles() {
  const handles = [];
  if (editorMode === 'weapon' && editorSelectedIdx >= 0 && editorShip.weaponSlots[editorSelectedIdx]) {
    const slot = editorShip.weaponSlots[editorSelectedIdx];
    const p = shipToCanvas(slot.locations || [0,0]);
    const r = (SLOT_RADIUS[slot.size] || 6);
    handles.push({type:'weapon-arc', x: p.x + (r*2.5+8), y: p.y});
  }
  if (editorMode === 'engine' && editorSelectedIdx >= 0 && editorShip.engineSlots[editorSelectedIdx]) {
    const eng = editorShip.engineSlots[editorSelectedIdx];
    const p = shipToCanvas(eng.location || [0,0]);
    const angRad = -Math.PI/2 + (eng.angle||0) * Math.PI/180;
    const el = (eng.length||20)*editorScale;
    const ew = (eng.width||10)*editorScale;
    handles.push({type:'engine-w', x: p.x - Math.sin(angRad)*ew/2, y: p.y + Math.cos(angRad)*ew/2});
    handles.push({type:'engine-l', x: p.x + Math.cos(angRad)*el, y: p.y + Math.sin(angRad)*el});
  }
  if (editorMode === 'props') {
    // Shield handles
    if (editorShip.shieldRadius) {
      const sc = editorShip.shieldCenter || [0,0];
      const sp = shipToCanvas(sc);
      const sr = editorShip.shieldRadius * editorScale;
      handles.push({type:'shield-r', x: sp.x + sr, y: sp.y});
    }
  }
  return handles;
}

// ============= CANVAS INTERACTION =============
function onCanvasMouseDown(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  editorLastMouse = {x: mx, y: my};

  if (e.button === 2) { editorIsPanning = true; return; }

  dlog('mouseDown', 'mode:', editorMode, 'at:', mx.toFixed(0), my.toFixed(0));

  // 1) Check resize handles (generous 12px radius)
  const handles = getResizeHandles();
  for (const h of handles) {
    if (Math.hypot(mx - h.x, my - h.y) < 12) {
      dlog('hit resize handle:', h.type);
      pushUndo();
      editorResizing = true;
      editorResizeHandle = {type: h.type, startMouse: {x: mx, y: my}};
      if (h.type === 'shield-r') editorResizeHandle.startVal = editorShip.shieldRadius || 0;
      if (h.type === 'engine-w') editorResizeHandle.startVal = editorShip.engineSlots[editorSelectedIdx].width || 10;
      if (h.type === 'engine-l') editorResizeHandle.startVal = editorShip.engineSlots[editorSelectedIdx].length || 20;
      return;
    }
  }

  // 2) Props mode: shield center and mass center (generous hit areas)
  if (editorMode === 'props') {
    // Shield center (the cyan dot)
    if (editorShip.shieldCenter || editorShip.shieldRadius) {
      const sc = editorShip.shieldCenter || [0,0];
      const sp = shipToCanvas(sc);
      const dist = Math.hypot(mx - sp.x, my - sp.y);
      dlog('shield center dist:', dist.toFixed(1));
      if (dist < HIT_RADIUS) {
        dlog('hit shield center');
        pushUndo();
        editorDragging = true;
        editorDragTarget = 'shield-center';
        return;
      }
    }
    // Mass center (the white crosshair)
    const cc = getCanvasCenter();
    const distCC = Math.hypot(mx - cc.x, my - cc.y);
    dlog('mass center dist:', distCC.toFixed(1));
    if (distCC < HIT_RADIUS) {
      dlog('hit mass center');
      pushUndo();
      editorDragging = true;
      editorDragTarget = 'mass-center';
      return;
    }
  }

  // 3) Mode-specific element selection
  if (editorMode === 'weapon' && editorShip.weaponSlots) {
    for (let i = editorShip.weaponSlots.length - 1; i >= 0; i--) {
      const slot = editorShip.weaponSlots[i];
      const p = shipToCanvas(slot.locations || [0,0]);
      const r = Math.max((SLOT_RADIUS[slot.size] || 6) + 4, HIT_RADIUS);
      if (Math.hypot(mx - p.x, my - p.y) < r) {
        dlog('hit weapon slot', i, slot.id);
        pushUndo();
        editorSelectedIdx = i;
        editorDragging = true;
        editorDragTarget = 'weapon';
        renderSidebar(); drawCanvas();
        return;
      }
    }
    editorSelectedIdx = -1;
    renderSidebar(); drawCanvas();

  } else if (editorMode === 'engine' && editorShip.engineSlots) {
    for (let i = editorShip.engineSlots.length - 1; i >= 0; i--) {
      const eng = editorShip.engineSlots[i];
      const p = shipToCanvas(eng.location || [0,0]);
      if (Math.hypot(mx - p.x, my - p.y) < Math.max(15, HIT_RADIUS)) {
        dlog('hit engine', i);
        pushUndo();
        editorSelectedIdx = i;
        editorDragging = true;
        editorDragTarget = 'engine';
        renderSidebar(); drawCanvas();
        return;
      }
    }
    editorSelectedIdx = -1;
    renderSidebar(); drawCanvas();

  } else if (editorMode === 'bounds' && editorShip.bounds) {
    const bounds = editorShip.bounds;
    for (let i = 0; i < bounds.length; i += 2) {
      const p = shipToCanvas([bounds[i], bounds[i+1]]);
      if (Math.hypot(mx - p.x, my - p.y) < HIT_RADIUS) {
        dlog('hit bound point', i/2);
        pushUndo();
        editorSelectedIdx = i / 2;
        editorDragging = true;
        editorDragTarget = 'bound';
        renderSidebar(); drawCanvas();
        return;
      }
    }
    // Edge insertion
    for (let i = 0; i < bounds.length; i += 2) {
      const ni = (i + 2) % bounds.length;
      const p1 = shipToCanvas([bounds[i], bounds[i+1]]);
      const p2 = shipToCanvas([bounds[ni], bounds[ni+1]]);
      if (pointToSegmentDist(mx, my, p1.x, p1.y, p2.x, p2.y) < 8) {
        pushUndo();
        const shipCoord = canvasToShip(mx, my);
        const insertIdx = i + 2;
        bounds.splice(insertIdx, 0, shipCoord[0], shipCoord[1]);
        editorSelectedIdx = insertIdx / 2;
        dlog('inserted bound point at', insertIdx/2);
        renderSidebar(); drawCanvas();
        return;
      }
    }
    editorSelectedIdx = -1;
    renderSidebar(); drawCanvas();
  }
}

function onCanvasMouseMove(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const dx = mx - editorLastMouse.x;
  const dy = my - editorLastMouse.y;
  editorLastMouse = {x: mx, y: my};

  // Cursor hint
  const handles = getResizeHandles();
  let onHandle = handles.some(h => Math.hypot(mx - h.x, my - h.y) < 12);
  // Also check if hovering over shield-center or mass-center in props mode
  if (editorMode === 'props') {
    const cc = getCanvasCenter();
    if (Math.hypot(mx - cc.x, my - cc.y) < HIT_RADIUS) onHandle = true;
    if (editorShip.shieldCenter) {
      const sp = shipToCanvas(editorShip.shieldCenter);
      if (Math.hypot(mx - sp.x, my - sp.y) < HIT_RADIUS) onHandle = true;
    }
  }
  editorCanvas.style.cursor = onHandle ? 'grab' : (editorDragging ? 'grabbing' : (editorIsPanning ? 'move' : 'default'));

  if (editorIsPanning) {
    editorPan.x += dx; editorPan.y += dy;
    drawCanvas();
    return;
  }

  if (editorResizing && editorResizeHandle) {
    const totalDx = mx - editorResizeHandle.startMouse.x;
    const totalDy = my - editorResizeHandle.startMouse.y;
    const totalDist = Math.hypot(totalDx, totalDy);
    const sign = (totalDx + totalDy > 0) ? 1 : -1;

    if (editorResizeHandle.type === 'shield-r') {
      editorShip.shieldRadius = +Math.max(1, editorResizeHandle.startVal + sign * totalDist / editorScale).toFixed(1);
    } else if (editorResizeHandle.type === 'engine-w' && editorShip.engineSlots[editorSelectedIdx]) {
      editorShip.engineSlots[editorSelectedIdx].width = +Math.max(1, editorResizeHandle.startVal + sign * totalDist / editorScale).toFixed(1);
    } else if (editorResizeHandle.type === 'engine-l' && editorShip.engineSlots[editorSelectedIdx]) {
      editorShip.engineSlots[editorSelectedIdx].length = +Math.max(1, editorResizeHandle.startVal + sign * totalDist / editorScale).toFixed(1);
    }
    renderSidebar(); drawCanvas();
    return;
  }

  if (editorDragging && editorDragTarget) {
    const shipCoord = canvasToShip(mx, my);

    if (editorDragTarget === 'weapon' && editorShip.weaponSlots[editorSelectedIdx]) {
      editorShip.weaponSlots[editorSelectedIdx].locations = [+shipCoord[0].toFixed(1), +shipCoord[1].toFixed(1)];
    } else if (editorDragTarget === 'engine' && editorShip.engineSlots[editorSelectedIdx]) {
      editorShip.engineSlots[editorSelectedIdx].location = [+shipCoord[0].toFixed(1), +shipCoord[1].toFixed(1)];
    } else if (editorDragTarget === 'bound') {
      const bi = editorSelectedIdx * 2;
      editorShip.bounds[bi] = +shipCoord[0].toFixed(1);
      editorShip.bounds[bi + 1] = +shipCoord[1].toFixed(1);
    } else if (editorDragTarget === 'shield-center') {
      if (!editorShip.shieldCenter) editorShip.shieldCenter = [0,0];
      editorShip.shieldCenter = [+shipCoord[0].toFixed(1), +shipCoord[1].toFixed(1)];
      dlog('drag shield-center to', editorShip.shieldCenter);
    } else if (editorDragTarget === 'mass-center') {
      // Dragging mass center = change center[0], center[1] (sprite anchor point)
      // center = [distFromLeft, distFromTop] in image pixels
      // The sprite is drawn at: drawX = cc.x - center[0]*scale, drawY = cc.y - center[1]*scale
      // When user drags the crosshair by (dx, dy) pixels on canvas,
      // we want the sprite to stay still but the origin to move.
      // So center[0] += dx/scale (moving origin right on image = increasing distFromLeft)
      // But our canvas maps: canvasX_left = -shipY, so dx on canvas = -dy in ship...
      // Actually simpler: center[0] is dist from LEFT of image. If crosshair moves RIGHT (+dx),
      // origin moves right on image, so center[0] increases. But since canvasX = cc.x - loc[1]*scale,
      // and we want the sprite to NOT move, only the origin:
      // newCenter[0] = center[0] - dx/scale  ... no wait, let me think clearly.
      //
      // Sprite is drawn at: drawX = cc.x - center[0]*scale
      // cc.x = canvasW/2 + pan.x
      // If user drags crosshair by (dx, dy), we DON'T move pan.
      // Instead we change center so that the NEW cc (which hasn't changed) still makes sense.
      // The origin on the sprite was at pixel (center[0], center[1]).
      // The mouse moved (dx, dy) on canvas. This means the user wants the origin to move
      // by (dx, dy) canvas pixels relative to the sprite.
      // In image pixel coords: dImgX = dx/scale, dImgY = dy/scale
      // Since canvas maps: img right = canvas right when center doesn't change...
      // Actually the sprite top-left is at (cc.x - center[0]*s, cc.y - center[1]*s)
      // The origin (cc) is at center[0]*s from the left of sprite on canvas.
      // If we want origin to move right by dx canvas pixels: center[0] += dx/scale
      // But wait: shipToCanvas uses cc.x - loc[1]*scale. If we increase center[0],
      // drawX = cc.x - center[0]*scale shrinks, meaning sprite moves LEFT.
      // But the cc doesn't change, so the origin stays, sprite moves left = origin moves RIGHT on sprite. Correct!
      if (!editorShip.center) editorShip.center = [0,0];
      editorShip.center[0] = +(editorShip.center[0] + dx / editorScale).toFixed(1);
      editorShip.center[1] = +(editorShip.center[1] + dy / editorScale).toFixed(1);
      dlog('drag mass-center to', editorShip.center);
    }

    renderSidebar(); drawCanvas();
  }
}

function onCanvasMouseUp(e) {
  if (editorDragging) {
    dlog('mouseUp', 'target:', editorDragTarget);
  }
  editorDragging = false;
  editorDragTarget = null;
  editorIsPanning = false;
  editorResizing = false;
  editorResizeHandle = null;
}

function onCanvasWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  editorScale *= factor;
  editorScale = Math.max(0.1, Math.min(10, editorScale));
  drawCanvas();
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const ddx = x2 - x1, ddy = y2 - y1;
  const lenSq = ddx*ddx + ddy*ddy;
  if (lenSq === 0) return Math.hypot(px-x1, py-y1);
  let t = ((px-x1)*ddx + (py-y1)*ddy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1+t*ddx), py - (y1+t*ddy));
}

// ============= SIDEBAR =============
function renderSidebar() {
  if (!editorShip) return;
  const panel = document.getElementById('sidebarPanel');
  let html = '';

  html += buildSection('船体属性', null, buildHullPropsBasic(), true);
  html += buildSection('贴图', null, buildSpriteSection(), false);
  html += buildSection('质量中心', null, buildCenterSection(), false);
  html += buildSection('护盾发生器', null, buildShieldSection(), false);

  const wCount = editorShip.weaponSlots ? editorShip.weaponSlots.length : 0;
  html += buildSection('武器插槽', wCount, buildWeaponSlots(), editorMode === 'weapon');

  const eCount = editorShip.engineSlots ? editorShip.engineSlots.length : 0;
  html += buildSection('引擎', eCount, buildEngineSlots(), editorMode === 'engine');

  const bCount = editorShip.bounds ? Math.floor(editorShip.bounds.length / 2) : 0;
  html += buildSection('碰撞边界', bCount, buildBounds(), editorMode === 'bounds');

  const bwCount = editorShip.builtInWeapons ? Object.keys(editorShip.builtInWeapons).length : 0;
  html += buildSection('内置武器', bwCount, buildBuiltinWeapons(), false);

  const bmCount = editorShip.builtInMods ? editorShip.builtInMods.length : 0;
  html += buildSection('内置船插', bmCount, buildBuiltinMods(), false);

  const bwgCount = editorShip.builtInWings ? editorShip.builtInWings.length : 0;
  html += buildSection('内置联队', bwgCount, buildBuiltinWings(), false);

  panel.innerHTML = html;
}

function buildSection(title, badge, content, open) {
  if (sectionOpenState[title] === undefined) sectionOpenState[title] = open;
  const isOpen = sectionOpenState[title];
  const badgeHtml = badge !== null && badge !== undefined ? `<span class="badge">${badge}</span>` : '';
  return `<div class="sidebar-section${isOpen ? ' open' : ''}">
    <div class="sec-header" onclick="sectionOpenState['${title}']=!sectionOpenState['${title}'];this.parentElement.classList.toggle('open')">
      <span class="arrow">&#9654;</span>
      <span class="sec-title">${title}</span>
      ${badgeHtml}
    </div>
    <div class="sec-body">${content}</div>
  </div>`;
}

function buildHullPropsBasic() {
  const s = editorShip;
  return `<div class="prop-grid">
    <label>hullId</label><input value="${escHtml(s.hullId||'')}" onchange="editorShip.hullId=this.value">
    <label>hullName</label><input value="${escHtml(s.hullName||'')}" onchange="editorShip.hullName=this.value">
    <label>hullSize</label><select onchange="editorShip.hullSize=this.value">
      ${['FRIGATE','DESTROYER','CRUISER','CAPITAL_SHIP'].map(v=>`<option${s.hullSize===v?' selected':''}>${v}</option>`).join('')}
    </select>
    <label>style</label><select onchange="editorShip.style=this.value">
      ${['LOW_TECH','MIDLINE','HIGH_TECH','CUSTOM'].map(v=>`<option${s.style===v?' selected':''}>${v}</option>`).join('')}
    </select>
    <label>width</label><input type="number" value="${s.width||0}" onchange="editorShip.width=+this.value;drawCanvas()">
    <label>height</label><input type="number" value="${s.height||0}" onchange="editorShip.height=+this.value;drawCanvas()">
    <label>碰撞半径</label><input type="number" value="${s.collisionRadius||0}" onchange="editorShip.collisionRadius=+this.value;drawCanvas()">
  </div>`;
}

function buildSpriteSection() {
  const s = editorShip;
  return `<div class="prop-grid">
    <label>当前贴图</label><span style="font-size:11px;color:var(--accent);word-break:break-all">${escHtml(s.spriteName || '无')}</span>
    <label>选择图片</label><div>
      <input type="file" id="spriteFileInput" accept="image/png" style="display:none" onchange="handleSpriteUpload(this)">
      <button class="tab-btn" onclick="document.getElementById('spriteFileInput').click()" style="font-size:11px;padding:3px 10px">选择本地图片...</button>
    </div>
  </div>
  <div style="font-size:10px;color:var(--text-dim);margin-top:4px">选择 PNG 图片后自动上传至 graphics/ships/ 并应用。</div>`;
}

function buildCenterSection() {
  const s = editorShip;
  const center = s.center || [0, 0];
  return `<div class="prop-grid">
    <label>center[0]</label><input type="number" step="0.5" value="${center[0]}" onchange="pushUndo();if(!editorShip.center)editorShip.center=[0,0];editorShip.center[0]=+this.value;drawCanvas()">
    <label>center[1]</label><input type="number" step="0.5" value="${center[1]}" onchange="pushUndo();if(!editorShip.center)editorShip.center=[0,0];editorShip.center[1]=+this.value;drawCanvas()">
  </div>
  <div style="font-size:10px;color:var(--text-dim);margin-top:4px">center = [距左边距, 距上边距]（像素）<br>切换到「属性」模式，拖拽白色十字可调整</div>`;
}

function buildShieldSection() {
  const s = editorShip;
  const sc = s.shieldCenter || [0, 0];
  return `<div class="prop-grid">
    <label>盾中心 [0]</label><input type="number" step="0.5" value="${sc[0]}" onchange="pushUndo();if(!editorShip.shieldCenter)editorShip.shieldCenter=[0,0];editorShip.shieldCenter[0]=+this.value;drawCanvas()">
    <label>盾中心 [1]</label><input type="number" step="0.5" value="${sc[1]}" onchange="pushUndo();if(!editorShip.shieldCenter)editorShip.shieldCenter=[0,0];editorShip.shieldCenter[1]=+this.value;drawCanvas()">
    <label>盾半径</label><input type="number" step="1" value="${s.shieldRadius||0}" onchange="pushUndo();editorShip.shieldRadius=+this.value;drawCanvas()">
  </div>
  <div style="font-size:10px;color:var(--text-dim);margin-top:4px">切换到「属性」模式：<br>• 拖拽青色圆点 = 移动护盾中心<br>• 拖拽白色方块 = 调整护盾半径</div>`;
}

function buildWeaponSlots() {
  if (!editorShip.weaponSlots) editorShip.weaponSlots = [];
  const slots = editorShip.weaponSlots;
  let html = '<div class="slot-list">';
  slots.forEach((slot, i) => {
    const color = WEAPON_COLORS[slot.type] || '#888';
    const sel = (editorMode === 'weapon' && editorSelectedIdx === i) ? ' selected' : '';
    html += `<div class="slot-item${sel}" onclick="editorSelectedIdx=${i};renderSidebar();drawCanvas()">
      <span class="dot" style="background:${color}"></span>
      <span>${escHtml(slot.id||'?')}</span>
      <span style="color:var(--text-dim);font-size:10px">${slot.size} ${slot.type}</span>
    </div>`;
  });
  html += '</div>';

  if (editorMode === 'weapon' && editorSelectedIdx >= 0 && editorSelectedIdx < slots.length) {
    const slot = slots[editorSelectedIdx];
    const loc = slot.locations || [0, 0];
    html += `<div class="prop-grid" style="margin-top:8px;">
      <label>id</label><input value="${escHtml(slot.id||'')}" onchange="editorShip.weaponSlots[${editorSelectedIdx}].id=this.value;renderSidebar()">
      <label>size</label><select onchange="editorShip.weaponSlots[${editorSelectedIdx}].size=this.value;drawCanvas()">
        ${['SMALL','MEDIUM','LARGE'].map(v=>`<option${slot.size===v?' selected':''}>${v}</option>`).join('')}
      </select>
      <label>type</label><select onchange="editorShip.weaponSlots[${editorSelectedIdx}].type=this.value;renderSidebar();drawCanvas()">
        ${['BALLISTIC','ENERGY','MISSILE','HYBRID','UNIVERSAL','SYNERGY','COMPOSITE','LAUNCH_BAY','DECORATIVE','SYSTEM','STATION_MODULE'].map(v=>`<option${slot.type===v?' selected':''}>${v}</option>`).join('')}
      </select>
      <label>mount</label><select onchange="editorShip.weaponSlots[${editorSelectedIdx}].mount=this.value">
        ${['TURRET','HARDPOINT','HIDDEN'].map(v=>`<option${slot.mount===v?' selected':''}>${v}</option>`).join('')}
      </select>
      <label>angle</label><input type="number" value="${slot.angle||0}" onchange="editorShip.weaponSlots[${editorSelectedIdx}].angle=+this.value;drawCanvas()">
      <label>arc</label><input type="number" value="${slot.arc||0}" onchange="editorShip.weaponSlots[${editorSelectedIdx}].arc=+this.value;drawCanvas()">
      <label>loc X</label><input type="number" step="0.5" value="${loc[0]}" onchange="editorShip.weaponSlots[${editorSelectedIdx}].locations[0]=+this.value;drawCanvas()">
      <label>loc Y</label><input type="number" step="0.5" value="${loc[1]}" onchange="editorShip.weaponSlots[${editorSelectedIdx}].locations[1]=+this.value;drawCanvas()">
    </div>`;
  }

  html += `<div class="sec-actions">
    <button onclick="addWeaponSlot()">+ 新建武器插槽</button>
    <button class="danger" onclick="deleteWeaponSlot()">删除选中</button>
  </div>`;
  return html;
}

function buildEngineSlots() {
  if (!editorShip.engineSlots) editorShip.engineSlots = [];
  const engines = editorShip.engineSlots;
  let html = '<div class="slot-list">';
  engines.forEach((eng, i) => {
    const sel = (editorMode === 'engine' && editorSelectedIdx === i) ? ' selected' : '';
    html += `<div class="slot-item${sel}" onclick="editorSelectedIdx=${i};renderSidebar();drawCanvas()">
      <span class="dot" style="background:#f59e0b"></span>
      <span>引擎 ${i}</span>
      <span style="color:var(--text-dim);font-size:10px">${(eng.width||0).toFixed(0)}×${(eng.length||0).toFixed(0)}</span>
    </div>`;
  });
  html += '</div>';

  if (editorMode === 'engine' && editorSelectedIdx >= 0 && editorSelectedIdx < engines.length) {
    const eng = engines[editorSelectedIdx];
    const loc = eng.location || [0, 0];
    html += `<div class="prop-grid" style="margin-top:8px;">
      <label>angle</label><input type="number" value="${eng.angle||0}" onchange="editorShip.engineSlots[${editorSelectedIdx}].angle=+this.value;drawCanvas()">
      <label>width</label><input type="number" step="0.5" value="${eng.width||0}" onchange="editorShip.engineSlots[${editorSelectedIdx}].width=+this.value;drawCanvas()">
      <label>length</label><input type="number" step="0.5" value="${eng.length||0}" onchange="editorShip.engineSlots[${editorSelectedIdx}].length=+this.value;drawCanvas()">
      <label>contrailSize</label><input type="number" step="0.5" value="${eng.contrailSize||0}" onchange="editorShip.engineSlots[${editorSelectedIdx}].contrailSize=+this.value">
      <label>style</label><select onchange="editorShip.engineSlots[${editorSelectedIdx}].style=this.value">
        ${['LOW_TECH','MIDLINE','HIGH_TECH','CUSTOM'].map(v=>`<option${eng.style===v?' selected':''}>${v}</option>`).join('')}
      </select>
      <label>loc X</label><input type="number" step="0.5" value="${loc[0]}" onchange="editorShip.engineSlots[${editorSelectedIdx}].location[0]=+this.value;drawCanvas()">
      <label>loc Y</label><input type="number" step="0.5" value="${loc[1]}" onchange="editorShip.engineSlots[${editorSelectedIdx}].location[1]=+this.value;drawCanvas()">
    </div>`;
  }

  html += `<div class="sec-actions">
    <button onclick="addEngine()">+ 新建引擎</button>
    <button class="danger" onclick="deleteEngine()">删除选中</button>
  </div>`;
  return html;
}

function buildBounds() {
  if (!editorShip.bounds) editorShip.bounds = [];
  const bounds = editorShip.bounds;
  let html = '<div class="slot-list" style="max-height:300px">';
  for (let i = 0; i < bounds.length; i += 2) {
    const idx = i / 2;
    const sel = (editorMode === 'bounds' && editorSelectedIdx === idx) ? ' selected' : '';
    html += `<div class="bound-item${sel}" onclick="editorSelectedIdx=${idx};renderSidebar();drawCanvas()">
      <span style="color:var(--text-dim);width:20px">${idx}</span>
      <input type="number" step="0.5" value="${bounds[i]}" onchange="editorShip.bounds[${i}]=+this.value;drawCanvas()">
      <input type="number" step="0.5" value="${bounds[i+1]}" onchange="editorShip.bounds[${i+1}]=+this.value;drawCanvas()">
    </div>`;
  }
  html += '</div>';
  html += `<div class="sec-actions">
    <button onclick="addBoundPoint()">+ 添加点</button>
    <button class="danger" onclick="deleteBoundPoint()">删除点</button>
  </div>`;
  return html;
}

function buildBuiltinWeapons() {
  if (!editorShip.builtInWeapons) editorShip.builtInWeapons = {};
  const entries = Object.entries(editorShip.builtInWeapons);
  let html = '';
  entries.forEach(([slotId, weaponId]) => {
    html += `<div class="builtin-row">
      <input value="${escHtml(slotId)}" placeholder="slotId" onchange="renameBuiltinWeapon('${escHtml(slotId)}',this.value)">
      <input value="${escHtml(weaponId)}" placeholder="weaponId" onchange="editorShip.builtInWeapons['${escHtml(slotId)}']=this.value">
      <button onclick="deleteBuiltinWeapon('${escHtml(slotId)}')">删除</button>
    </div>`;
  });
  html += `<div class="sec-actions"><button onclick="addBuiltinWeapon()">+ 添加</button></div>`;
  return html;
}

function buildBuiltinMods() {
  if (!editorShip.builtInMods) editorShip.builtInMods = [];
  let html = '';
  editorShip.builtInMods.forEach((mod, i) => {
    html += `<div class="builtin-row">
      <input value="${escHtml(mod)}" onchange="editorShip.builtInMods[${i}]=this.value">
      <button onclick="editorShip.builtInMods.splice(${i},1);renderSidebar()">删除</button>
    </div>`;
  });
  html += `<div class="sec-actions"><button onclick="editorShip.builtInMods.push('');renderSidebar()">+ 添加</button></div>`;
  return html;
}

function buildBuiltinWings() {
  if (!editorShip.builtInWings) editorShip.builtInWings = [];
  let html = '';
  editorShip.builtInWings.forEach((wing, i) => {
    html += `<div class="builtin-row">
      <input value="${escHtml(wing)}" onchange="editorShip.builtInWings[${i}]=this.value">
      <button onclick="editorShip.builtInWings.splice(${i},1);renderSidebar()">删除</button>
    </div>`;
  });
  html += `<div class="sec-actions"><button onclick="editorShip.builtInWings.push('');renderSidebar()">+ 添加</button></div>`;
  return html;
}

// ============= EDITOR ACTIONS =============
function addWeaponSlot() {
  pushUndo();
  if (!editorShip.weaponSlots) editorShip.weaponSlots = [];
  editorShip.weaponSlots.push({
    id: 'WS_NEW_' + editorShip.weaponSlots.length,
    size: 'MEDIUM', type: 'BALLISTIC', mount: 'TURRET',
    arc: 120, angle: 0, locations: [0, 0]
  });
  editorSelectedIdx = editorShip.weaponSlots.length - 1;
  dlog('addWeaponSlot', editorSelectedIdx);
  renderSidebar(); drawCanvas();
}

function deleteWeaponSlot() {
  if (editorSelectedIdx < 0 || !editorShip.weaponSlots[editorSelectedIdx]) return;
  pushUndo();
  dlog('deleteWeaponSlot', editorSelectedIdx);
  editorShip.weaponSlots.splice(editorSelectedIdx, 1);
  editorSelectedIdx = -1;
  renderSidebar(); drawCanvas();
}

function addEngine() {
  pushUndo();
  if (!editorShip.engineSlots) editorShip.engineSlots = [];
  editorShip.engineSlots.push({
    angle: 180, contrailSize: 12, length: 30, width: 10,
    location: [-50, 0], style: 'LOW_TECH'
  });
  editorSelectedIdx = editorShip.engineSlots.length - 1;
  dlog('addEngine', editorSelectedIdx);
  renderSidebar(); drawCanvas();
}

function deleteEngine() {
  if (editorSelectedIdx < 0 || !editorShip.engineSlots[editorSelectedIdx]) return;
  pushUndo();
  editorShip.engineSlots.splice(editorSelectedIdx, 1);
  editorSelectedIdx = -1;
  renderSidebar(); drawCanvas();
}

function addBoundPoint() {
  pushUndo();
  if (!editorShip.bounds) editorShip.bounds = [];
  editorShip.bounds.push(0, 0);
  editorSelectedIdx = (editorShip.bounds.length / 2) - 1;
  renderSidebar(); drawCanvas();
}

function deleteBoundPoint() {
  if (editorSelectedIdx < 0) return;
  pushUndo();
  const bi = editorSelectedIdx * 2;
  if (bi < editorShip.bounds.length) {
    editorShip.bounds.splice(bi, 2);
    editorSelectedIdx = -1;
    renderSidebar(); drawCanvas();
  }
}

function addBuiltinWeapon() {
  if (!editorShip.builtInWeapons) editorShip.builtInWeapons = {};
  const key = 'WS_BUILTIN_' + Object.keys(editorShip.builtInWeapons).length;
  editorShip.builtInWeapons[key] = '';
  renderSidebar();
}

function deleteBuiltinWeapon(slotId) {
  delete editorShip.builtInWeapons[slotId];
  renderSidebar();
}

function renameBuiltinWeapon(oldKey, newKey) {
  if (oldKey === newKey) return;
  const val = editorShip.builtInWeapons[oldKey];
  delete editorShip.builtInWeapons[oldKey];
  editorShip.builtInWeapons[newKey] = val || '';
  renderSidebar();
}

// ============= WINDOW RESIZE =============
window.addEventListener('resize', () => {
  if (editorCanvas && document.getElementById('shipEditorModal').classList.contains('show')) {
    const panel = document.getElementById('canvasPanel');
    const rect = panel.getBoundingClientRect();
    editorCanvas.width = rect.width;
    editorCanvas.height = rect.height;
    drawCanvas();
  }
});
