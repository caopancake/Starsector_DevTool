import { appDataSyncBoundaryRule } from './app-data-sync-boundary.mjs';
import { componentApiBoundaryRule } from './component-api-boundary.mjs';
import { configComponentStoreBoundaryRule } from './config-component-store-boundary.mjs';
import { configEntityBoundaryRule } from './config-entity-boundary.mjs';
import { featureBoundaryRule } from './feature-boundary.mjs';
import { fileHistoryBoundaryRule } from './file-history-boundary.mjs';
import { frontendApiBoundaryRule } from './frontend-api-boundary.mjs';
import { hullReferenceBoundaryRule } from './hull-reference-boundary.mjs';
import { rustCommandRegistrationBoundaryRule } from './rust-command-registration-boundary.mjs';
import { rustCommandServiceBoundaryRule } from './rust-command-service-boundary.mjs';
import { rustLowerLayerBoundaryRule } from './rust-lower-layer-boundary.mjs';
import { rustServiceBoundaryRule } from './rust-service-boundary.mjs';
import { saveApiBoundaryRule } from './save-api-boundary.mjs';
import { schemaBoundaryRule } from './schema-boundary.mjs';
import { schemaRegistryBoundaryRule } from './schema-registry-boundary.mjs';
import { sharedBoundaryRule } from './shared-boundary.mjs';
import { storeApiBoundaryRule } from './store-api-boundary.mjs';

export const rules = [
  sharedBoundaryRule,
  featureBoundaryRule,
  hullReferenceBoundaryRule,
  frontendApiBoundaryRule,
  componentApiBoundaryRule,
  storeApiBoundaryRule,
  saveApiBoundaryRule,
  fileHistoryBoundaryRule,
  configEntityBoundaryRule,
  schemaBoundaryRule,
  schemaRegistryBoundaryRule,
  configComponentStoreBoundaryRule,
  rustCommandServiceBoundaryRule,
  rustCommandRegistrationBoundaryRule,
  rustServiceBoundaryRule,
  rustLowerLayerBoundaryRule,
  appDataSyncBoundaryRule,
];
