import { appDataSyncBoundaryRule } from './app-data-sync-boundary.mjs';
import { configEntityBoundaryRule } from './config-entity-boundary.mjs';
import { csvColumnSchemaBoundaryRule } from './csv-column-schema-boundary.mjs';
import { editModeBoundaryRule } from './edit-mode-boundary.mjs';
import { featureBoundaryRule } from './feature-boundary.mjs';
import { feedbackBoundaryRule } from './feedback-boundary.mjs';
import { fileChangeResultBoundaryRule } from './file-change-result-boundary.mjs';
import { fileHistoryBoundaryRule } from './file-history-boundary.mjs';
import { frontendApiBoundaryRule } from './frontend-api-boundary.mjs';
import { hullReferenceBoundaryRule } from './hull-reference-boundary.mjs';
import { namingBoundaryRule } from './naming-boundary.mjs';
import { orchestratorDomainNameBoundaryRule } from './orchestrator-domain-name-boundary.mjs';
import { rustCommandRegistrationBoundaryRule } from './rust-command-registration-boundary.mjs';
import { rustCommandServiceBoundaryRule } from './rust-command-service-boundary.mjs';
import { rustLowerLayerBoundaryRule } from './rust-lower-layer-boundary.mjs';
import { rustSaveHistoryBoundaryRule } from './rust-save-history-boundary.mjs';
import { rustServiceBoundaryRule } from './rust-service-boundary.mjs';
import { saveApiBoundaryRule } from './save-api-boundary.mjs';
import { schemaRegistryBoundaryRule } from './schema-registry-boundary.mjs';
import { sharedBoundaryRule } from './shared-boundary.mjs';
import { schemaEditingBoundaryRule } from './schema-editing-boundary.mjs';
import { userActionBoundaryRule } from './user-action-boundary.mjs';
import { windowEventsBoundaryRule } from './window-events-boundary.mjs';

export const rules = [
  sharedBoundaryRule,
  featureBoundaryRule,
  namingBoundaryRule,
  orchestratorDomainNameBoundaryRule,
  feedbackBoundaryRule,
  hullReferenceBoundaryRule,
  frontendApiBoundaryRule,
  saveApiBoundaryRule,
  fileHistoryBoundaryRule,
  userActionBoundaryRule,
  fileChangeResultBoundaryRule,
  configEntityBoundaryRule,
  schemaEditingBoundaryRule,
  csvColumnSchemaBoundaryRule,
  editModeBoundaryRule,
  schemaRegistryBoundaryRule,
  windowEventsBoundaryRule,
  rustCommandServiceBoundaryRule,
  rustCommandRegistrationBoundaryRule,
  rustServiceBoundaryRule,
  rustSaveHistoryBoundaryRule,
  rustLowerLayerBoundaryRule,
  appDataSyncBoundaryRule,
];
