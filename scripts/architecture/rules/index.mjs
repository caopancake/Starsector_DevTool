import { configModuleBoundaryRule } from './config-module-boundary.mjs';
import { csvDraftBoundaryRule } from './csv-draft-boundary.mjs';
import { csvModuleBoundaryRule } from './csv-module-boundary.mjs';
import { draftSessionBoundaryRule } from './draft-session-boundary.mjs';
import { editorModuleBoundaryRule } from './editor-module-boundary.mjs';
import { feedbackBoundaryRule } from './feedback-boundary.mjs';
import { fileHistoryBoundaryRule } from './file-history-boundary.mjs';
import { frontendLayerBoundaryRule } from './frontend-layer-boundary.mjs';
import { mainHistoryCommandBoundaryRule } from './main-history-command-boundary.mjs';
import { namingBoundaryRule } from './naming-boundary.mjs';
import { parserBoundaryRule } from './parser-boundary.mjs';
import { projectSessionBoundaryRule } from './project-session-boundary.mjs';
import { queryBoundaryRule } from './query-boundary.mjs';
import { resourceBoundaryRule } from './resource-boundary.mjs';
import { rustProjectLayerBoundaryRule } from './rust-project-layer-boundary.mjs';
import { schemaModuleBoundaryRule } from './schema-module-boundary.mjs';
import { sharedTypesBoundaryRule } from './shared-types-boundary.mjs';
import { windowBoundaryRule } from './window-boundary.mjs';
import { workspaceModuleBoundaryRule } from './workspace-module-boundary.mjs';
import { writeBoundaryRule } from './write-boundary.mjs';

export const rules = [
  frontendLayerBoundaryRule,
  mainHistoryCommandBoundaryRule,
  rustProjectLayerBoundaryRule,
  queryBoundaryRule,
  writeBoundaryRule,
  resourceBoundaryRule,
  fileHistoryBoundaryRule,
  projectSessionBoundaryRule,
  parserBoundaryRule,
  windowBoundaryRule,
  feedbackBoundaryRule,
  namingBoundaryRule,
  sharedTypesBoundaryRule,
  csvModuleBoundaryRule,
  csvDraftBoundaryRule,
  draftSessionBoundaryRule,
  schemaModuleBoundaryRule,
  configModuleBoundaryRule,
  editorModuleBoundaryRule,
  workspaceModuleBoundaryRule,
];
