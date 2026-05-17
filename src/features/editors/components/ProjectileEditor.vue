<template>
  <div class="modal-backdrop">
    <div class="projectile-window">
      <EditorHeader title="弹体编辑器" :subtitle="projectileId" />
      <div class="projectile-body">
        <n-collapse v-model:expanded-names="expandedSections" :theme-overrides="editorCollapseTheme">
          <n-collapse-item title="基础属性" name="basic">
            <div class="form-grid">
              <label>id</label><n-input :value="projectileId" disabled /> <label>specClass</label
              ><n-select v-model:value="localProjectile.specClass" :options="opts(['projectile', 'missile'])" />
            </div>
          </n-collapse-item>
          <template v-if="specClass === 'projectile'">
            <n-collapse-item title="弹体外观" name="visual">
              <div class="form-grid">
                <label>spawnType</label
                ><n-select :options="opts(['BALLISTIC', 'BALLISTIC_AS_BEAM', 'ENERGY'])" v-model:value="localProjectile.spawnType" />
                <label>bulletSprite</label><n-input v-model:value="localProjectile.bulletSprite" /> <label>length</label
                ><n-input-number v-model:value="localProjectile.length" /> <label>width</label
                ><n-input-number v-model:value="localProjectile.width" /> <label>textureScrollSpeed</label
                ><n-input-number v-model:value="localProjectile.textureScrollSpeed" /> <label>pixelsPerTexel</label
                ><n-input-number v-model:value="localProjectile.pixelsPerTexel" />
              </div>
              <ColorPicker label="fringeColor" v-model="fringeColor" />
              <ColorPicker label="coreColor" v-model="coreColor" />
              <input type="file" accept="image/png" @change="uploadSpriteFile('bulletSprite', $event)" />
            </n-collapse-item>
            <n-collapse-item title="碰撞与消散" name="collision">
              <div class="form-grid">
                <label>collisionClass</label
                ><n-select
                  :options="
                    opts([
                      'PROJECTILE_NO_FF',
                      'PROJECTILE_FF',
                      'PROJECTILE_FIGHTER',
                      'MISSILE_NO_FF',
                      'MISSILE_FF',
                      'RAY',
                      'RAY_FIGHTER',
                      'HITS_SHIPS_AND_ASTEROIDS',
                      'NONE',
                    ])
                  "
                  v-model:value="localProjectile.collisionClass"
                />
                <label>collisionClassByFighter</label><n-input v-model:value="localProjectile.collisionClassByFighter" />
                <label>fadeTime</label><n-input-number v-model:value="localProjectile.fadeTime" /> <label>hitGlowRadius</label
                ><n-input-number v-model:value="localProjectile.hitGlowRadius" />
              </div>
            </n-collapse-item>
          </template>
          <template v-else-if="specClass === 'missile'">
            <n-collapse-item title="导弹外观" name="missileVisual">
              <div class="form-grid">
                <label>missileType</label
                ><n-select v-model:value="localProjectile.missileType" :options="opts(['MISSILE', 'ROCKET', 'MIRV', 'PHASE'])" />
                <label>sprite</label><n-input v-model:value="localProjectile.sprite" /> <label>size W</label
                ><n-input-number :value="size[0]" @update:value="setArray('size', 0, $event)" /> <label>size H</label
                ><n-input-number :value="size[1]" @update:value="setArray('size', 1, $event)" /> <label>center X</label
                ><n-input-number :value="center[0]" @update:value="setArray('center', 0, $event)" /> <label>center Y</label
                ><n-input-number :value="center[1]" @update:value="setArray('center', 1, $event)" /> <label>collisionRadius</label
                ><n-input-number v-model:value="localProjectile.collisionRadius" />
              </div>
              <ColorPicker label="explosionColor" v-model="explosionColor" />
              <input type="file" accept="image/png" @change="uploadSpriteFile('sprite', $event)" />
            </n-collapse-item>
            <n-collapse-item title="引擎参数" name="engine">
              <ObjectEditor v-model="engineSpec" />
            </n-collapse-item>
            <n-collapse-item title="引擎槽位" name="slots">
              <div class="bounds-list">
                <div v-for="(slot, i) in engineSlots" :key="i">
                  <span>{{ i }}</span>
                  <n-input-number :value="slotLoc(slot)[0]" @update:value="setSlotLoc(i, 0, $event)" />
                  <n-input-number :value="slotLoc(slot)[1]" @update:value="setSlotLoc(i, 1, $event)" />
                  <n-button size="tiny" type="error" ghost @click="engineSlots.splice(i, 1)">删除</n-button>
                </div>
              </div>
              <n-button @click="engineSlots.push({ loc: [0, 0], angle: 180, width: 8, length: 20, style: 'CUSTOM' })">添加引擎槽</n-button>
            </n-collapse-item>
            <n-collapse-item title="爆炸与时间" name="explosion">
              <div class="form-grid">
                <label>explosionRadius</label><n-input-number v-model:value="localProjectile.explosionRadius" /> <label>flameoutTime</label
                ><n-input-number v-model:value="localProjectile.flameoutTime" /> <label>armingTime</label
                ><n-input-number v-model:value="localProjectile.armingTime" /> <label>fadeTime</label
                ><n-input-number v-model:value="localProjectile.fadeTime" />
              </div>
              <ObjectEditor v-model="explosionSpec" />
            </n-collapse-item>
          </template>
          <n-collapse-item v-else title="通用属性" name="generic">
            <textarea v-model="genericJson" @change="applyGeneric" />
          </n-collapse-item>
        </n-collapse>
      </div>
      <EditorFooter note="结构化 JSON 写回，内部字段会被后端剔除。">
        <template #actions>
          <n-button @click="$emit('close')">关闭</n-button>
          <n-button type="primary" @click="save">保存 .proj</n-button>
        </template>
      </EditorFooter>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import ColorPicker from '../../../shared/components/ColorPicker.vue';
import EditorFooter from './common/EditorFooter.vue';
import EditorHeader from './common/EditorHeader.vue';
import ObjectEditor from './common/ObjectEditor.vue';
import { saveProjectileSpecWithHistory } from '../editor.service';
import type { RowData } from '../../../shared/types';
import type { FileChangeRecord } from '../../../shared/api/tauri';
import { arr, str } from '../../../shared/lib/starsector';
import { formatError } from '../../../shared/lib/errors';
import { normalizeProjectileSpec } from '../lib/normalize';
import { useObjectField } from '../composables/useObjectField';
import { useSpriteUpload } from '../composables/useSpriteUpload';
import { editorCollapseTheme, toOptions as opts } from '../lib/editor-constants';

const props = defineProps<{ modRoot: string; projectileId: string; projectile?: RowData }>();
const emit = defineEmits<{ close: []; saved: [id: string, projectile: RowData, changes: FileChangeRecord[]] }>();
const message = useMessage();
const dialog = useDialog();
const localProjectile = ref<RowData>(normalizeProjectileSpec(props.projectile || { id: props.projectileId, specClass: 'projectile' }));
const expandedSections = ref(['basic']);
const { bindObjectField } = useObjectField(localProjectile);
const { uploadSpriteFile: uploadSpriteInput } = useSpriteUpload();
const specClass = computed(() => str(localProjectile.value.specClass, 'projectile'));
const size = computed(() => arr(localProjectile.value.size, [0, 0]));
const center = computed(() => arr(localProjectile.value.center, [0, 0]));
const engineSlots = computed<RowData[]>(() =>
  Array.isArray(localProjectile.value.engineSlots) ? (localProjectile.value.engineSlots as RowData[]) : [],
);
const genericJson = ref(JSON.stringify(localProjectile.value, null, 2));
const fringeColor = computed({
  get: () => arr(localProjectile.value.fringeColor, [255, 255, 255, 255]),
  set: (v) => (localProjectile.value.fringeColor = v),
});
const coreColor = computed({
  get: () => arr(localProjectile.value.coreColor, [255, 255, 255, 255]),
  set: (v) => (localProjectile.value.coreColor = v),
});
const explosionColor = computed({
  get: () => arr(localProjectile.value.explosionColor, [255, 200, 50, 255]),
  set: (v) => (localProjectile.value.explosionColor = v),
});
const engineSpec = bindObjectField('engineSpec');
const explosionSpec = bindObjectField('explosionSpec');

function setArray(key: string, idx: number, value: number | null) {
  const v = arr(localProjectile.value[key], [0, 0]);
  v[idx] = value || 0;
  localProjectile.value[key] = v;
}
function slotLoc(slot: RowData) {
  return arr(slot.loc, [0, 0]);
}
function setSlotLoc(i: number, axis: number, value: number | null) {
  const loc = slotLoc(engineSlots.value[i]);
  loc[axis] = value || 0;
  engineSlots.value[i].loc = loc;
}
function applyGeneric() {
  try {
    localProjectile.value = normalizeProjectileSpec(JSON.parse(genericJson.value));
  } catch {
    message.error('JSON 无效');
  }
}
async function uploadSpriteFile(field: string, event: Event) {
  try {
    await uploadSpriteInput(event, {
      dialog,
      modRoot: props.modRoot,
      subfolder: 'missiles',
      onUploaded: (result) => {
        localProjectile.value[field] = result.path;
        message.success('贴图已上传');
      },
    });
  } catch (error) {
    message.error(`上传贴图失败：${formatError(error)}`);
  }
}
async function save() {
  try {
    const changes = await saveProjectileSpecWithHistory(props.modRoot, props.projectileId, localProjectile.value);
    emit('saved', props.projectileId, localProjectile.value, changes);
  } catch (error) {
    message.error(formatError(error));
  }
}
watch(
  () => props.projectile,
  (projectile) => {
    localProjectile.value = normalizeProjectileSpec(projectile || { id: props.projectileId, specClass: 'projectile' });
    genericJson.value = JSON.stringify(localProjectile.value, null, 2);
  },
  { deep: true },
);
</script>
