<template>
  <div class="modal-backdrop">
    <div class="projectile-window">
      <header class="editor-header">
        <strong>弹丸编辑器: {{ projectileId }}</strong>
      </header>
      <div class="projectile-body">
        <n-collapse default-expanded-names="basic">
          <n-collapse-item title="基础属性" name="basic">
            <div class="form-grid">
              <label>id</label><n-input :value="projectileId" disabled /> <label>specClass</label
              ><n-select v-model:value="localProjectile.specClass" :options="opts(['projectile', 'missile'])" />
            </div>
          </n-collapse-item>
          <template v-if="specClass === 'projectile'">
            <n-collapse-item title="弹丸外观" name="visual">
              <div class="form-grid">
                <label>spawnType</label
                ><n-select :options="opts(['BALLISTIC', 'BALLISTIC_AS_BEAM', 'ENERGY'])" v-model:value="localProjectile.spawnType" />
                <label>bulletSprite</label><n-input v-model:value="localProjectile.bulletSprite" /> <label>length</label
                ><n-input-number v-model:value="localProjectile.length" /> <label>width</label
                ><n-input-number v-model:value="localProjectile.width" /> <label>textureScrollSpeed</label
                ><n-input-number v-model:value="localProjectile.textureScrollSpeed" /> <label>pixelsPerTexel</label
                ><n-input-number v-model:value="localProjectile.pixelsPerTexel" />
              </div>
              <ColorArray label="fringeColor" v-model="fringeColor" />
              <ColorArray label="coreColor" v-model="coreColor" />
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
              <ColorArray label="explosionColor" v-model="explosionColor" />
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
      <footer class="editor-footer">
        <span>结构化 JSON 写回，内部字段会被后端剔除。</span>
        <n-button @click="$emit('close')">关闭</n-button>
        <n-button type="primary" @click="save">保存</n-button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue';
import { useDialog, useMessage } from 'naive-ui';
import { saveProjectile, uploadSprite } from '../../../shared/api/tauri';
import type { RowData } from '../../../shared/types';
import { arr, deepClone, fileToBase64, str } from '../../../shared/lib/starsector';

const props = defineProps<{ modRoot: string; projectileId: string; projectile?: RowData }>();
const emit = defineEmits<{ close: []; saved: [id: string, projectile: RowData] }>();
const message = useMessage();
const dialog = useDialog();
const localProjectile = ref<RowData>(deepClone(props.projectile || { id: props.projectileId, specClass: 'projectile' }));
const specClass = computed(() => str(localProjectile.value.specClass, 'projectile'));
const size = computed(() => arr(localProjectile.value.size, [0, 0]));
const center = computed(() => arr(localProjectile.value.center, [0, 0]));
const engineSlots = computed<RowData[]>(() =>
  Array.isArray(localProjectile.value.engineSlots)
    ? (localProjectile.value.engineSlots as RowData[])
    : ((localProjectile.value.engineSlots = []) as RowData[]),
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
const engineSpec = computed({ get: () => objectField('engineSpec'), set: (v) => (localProjectile.value.engineSpec = v) });
const explosionSpec = computed({ get: () => objectField('explosionSpec'), set: (v) => (localProjectile.value.explosionSpec = v) });

function opts(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}
function objectField(key: string): RowData {
  return localProjectile.value[key] && typeof localProjectile.value[key] === 'object' && !Array.isArray(localProjectile.value[key])
    ? (localProjectile.value[key] as RowData)
    : {};
}
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
    localProjectile.value = JSON.parse(genericJson.value);
  } catch {
    message.error('JSON 无效');
  }
}
async function uploadSpriteFile(field: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const b64 = await fileToBase64(file);
  let result = await uploadSprite(props.modRoot, file.name, b64, 'missiles', false);
  if (result.exists) {
    dialog.warning({
      title: '覆盖贴图？',
      content: result.message,
      positiveText: '覆盖',
      negativeText: '取消',
      onPositiveClick: async () => {
        result = await uploadSprite(props.modRoot, file.name, b64, 'missiles', true);
        localProjectile.value[field] = result.path;
        message.success('贴图已上传');
      },
    });
  } else {
    localProjectile.value[field] = result.path;
    message.success('贴图已上传');
  }
}
async function save() {
  await saveProjectile(props.modRoot, props.projectileId, localProjectile.value);
  emit('saved', props.projectileId, localProjectile.value);
}

const ColorArray = defineComponent({
  props: { label: { type: String, required: true }, modelValue: { type: Array, default: () => [255, 255, 255, 255] } },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const set = (i: number, v: number | null) => {
      const next = [...(p.modelValue as number[])];
      next[i] = v || 0;
      emit('update:modelValue', next);
    };
    return () =>
      h('div', { class: 'color-array' }, [
        h('strong', p.label),
        [0, 1, 2, 3].map((i) =>
          h('input', {
            type: 'number',
            min: 0,
            max: 255,
            value: (p.modelValue as number[])[i] ?? 255,
            onInput: (e: Event) => set(i, Number((e.target as HTMLInputElement).value)),
          }),
        ),
      ]);
  },
});
const ObjectEditor = defineComponent({
  props: { modelValue: { type: Object, default: () => ({}) } },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    const text = ref(JSON.stringify(p.modelValue || {}, null, 2));
    const apply = () => {
      try {
        emit('update:modelValue', JSON.parse(text.value || '{}'));
      } catch {}
    };
    return () =>
      h('textarea', { value: text.value, onInput: (e: Event) => (text.value = (e.target as HTMLTextAreaElement).value), onChange: apply });
  },
});
</script>
