import { configModuleBoundaryRule } from './config-module-boundary.mjs';
import { csvModuleBoundaryRule } from './csv-module-boundary.mjs';
import { editorModuleBoundaryRule } from './editor-module-boundary.mjs';
import { feedbackBoundaryRule } from './feedback-boundary.mjs';
import { frontendLayerBoundaryRule } from './frontend-layer-boundary.mjs';
import { historyBoundaryRule } from './history-boundary.mjs';
import { namingBoundaryRule } from './naming-boundary.mjs';
import { projectSessionContractBoundaryRule } from './project-session-contract-boundary.mjs';
import { queryBoundaryRule } from './query-boundary.mjs';
import { resourceBoundaryRule } from './resource-boundary.mjs';
import { rustProjectLayerBoundaryRule } from './rust-project-layer-boundary.mjs';
import { schemaModuleBoundaryRule } from './schema-module-boundary.mjs';
import { windowBoundaryRule } from './window-boundary.mjs';
import { workspaceModuleBoundaryRule } from './workspace-module-boundary.mjs';
import { writeBoundaryRule } from './write-boundary.mjs';

export const rules = [
  frontendLayerBoundaryRule,
  rustProjectLayerBoundaryRule,
  projectSessionContractBoundaryRule,
  queryBoundaryRule,
  writeBoundaryRule,
  resourceBoundaryRule,
  historyBoundaryRule,
  windowBoundaryRule,
  feedbackBoundaryRule,
  namingBoundaryRule,
  csvModuleBoundaryRule,
  schemaModuleBoundaryRule,
  configModuleBoundaryRule,
  editorModuleBoundaryRule,
  workspaceModuleBoundaryRule,
];
