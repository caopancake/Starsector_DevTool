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
        <p>舰船、武器、联队、舰船插件、工业和技能记录</p>
      </article>
      <article class="mod-overview-card">
        <span>配置</span>
        <strong>{{ configTotal }}</strong>
        <p>势力与战役配置项</p>
      </article>
      <article class="mod-overview-card wide">
        <span>目录</span>
        <strong>{{ overview.modRootText }}</strong>
        <p>当前工作区会原位读写该 Mod 目录下的数据文件</p>
      </article>
      <article class="mod-overview-card wide">
        <span>原版资源</span>
        <strong>{{ overview.coreAvailable ? '可用' : '不可用' }}</strong>
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
import { useProjectStore } from '@/stores/project.store';
import { buildConfigModOverview } from '@/domain/config/mod-overview';

const project = useProjectStore();
const data = computed(() => project.activeManifest);
const overview = computed(() => buildConfigModOverview(data.value));

const modName = computed(() => overview.value.modName);
const modVersion = computed(() => overview.value.modVersion);
const coreResourceText = computed(() => overview.value.coreResourceText);
const breakdown = computed(() => overview.value.breakdown);
const tableTotal = computed(() => overview.value.tableTotal);
const configTotal = computed(() => overview.value.configTotal);
</script>
