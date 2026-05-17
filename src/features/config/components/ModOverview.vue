<template>
  <section class="mod-overview-page">
    <header class="mod-overview-header">
      <div>
        <h1>{{ modName }}</h1>
        <p>{{ modVersion || '未声明版本' }}</p>
      </div>
    </header>

    <div class="mod-overview-grid">
      <article class="mod-overview-card">
        <span>数据表</span>
        <strong>{{ tableTotal }}</strong>
        <p>舰船、武器、联队、舰船插件和工业记录</p>
      </article>
      <article class="mod-overview-card">
        <span>配置</span>
        <strong>{{ configTotal }}</strong>
        <p>势力与战役配置项</p>
      </article>
      <article class="mod-overview-card wide">
        <span>目录</span>
        <strong>{{ data?.modRoot || '未加载' }}</strong>
        <p>当前工作区会原位读写该 Mod 目录下的数据文件</p>
      </article>
      <article class="mod-overview-card wide">
        <span>原版资源</span>
        <strong>{{ data?.coreAvailable ? '可用' : '不可用' }}</strong>
        <p>{{ coreResourceText }}</p>
      </article>
    </div>

    <div class="mod-overview-breakdown">
      <div v-for="item in breakdown" :key="item.label" class="mod-overview-breakdown-row">
        <span>{{ item.label }}</span>
        <strong>{{ item.count }}</strong>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '../../project/project-store';
import { cell, formatModVersion } from '../../../shared/lib/starsector';

const project = useProjectStore();
const data = computed(() => project.activeModData);

const modName = computed(() => cell(data.value?.modInfo?.name) || 'Mod 概览');
const modVersion = computed(() => formatModVersion(data.value?.modInfo?.version));
const coreResourceText = computed(() => {
  if (!data.value?.coreAvailable) return '未找到可用于贴图、Schema 和引用 fallback 的 starsector-core';
  return data.value.starsectorRoot ? `${data.value.starsectorRoot}\\starsector-core` : '已找到 starsector-core';
});
const breakdown = computed(() => [
  { label: '舰船', count: data.value?.ships.length ?? 0 },
  { label: '武器', count: data.value?.weapons.length ?? 0 },
  { label: '联队', count: data.value?.wings.length ?? 0 },
  { label: '舰船插件', count: data.value?.hullmods.length ?? 0 },
  { label: '战术系统', count: data.value?.shipSystems.length ?? 0 },
  { label: '工业', count: data.value?.industries.length ?? 0 },
  { label: '势力', count: data.value ? Object.keys(data.value.factionFiles).length : 0 },
  { label: '战役', count: data.value?.missionCount ?? 0 },
]);
const tableTotal = computed(() => breakdown.value.slice(0, 6).reduce((sum, item) => sum + item.count, 0));
const configTotal = computed(() => breakdown.value.slice(6).reduce((sum, item) => sum + item.count, 0));
</script>
