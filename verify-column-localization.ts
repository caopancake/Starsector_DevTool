/**
 * Column Localization Verification Script
 *
 * This script verifies that all visible columns (defined in TABLE_COLUMNS)
 * have corresponding schema entries with Chinese labels.
 *
 * Usage: npx ts-node verify-column-localization.ts
 * Or integrate into your build/test pipeline
 */

import type { TableKey } from '@/shared/types';

// Import TABLE_COLUMNS
const TABLE_COLUMNS: Record<TableKey, string[]> = {
  ships: [
    'name',
    'id',
    'designation',
    'system id',
    'hitpoints',
    'armor rating',
    'shield type',
    'shield arc',
    'shield efficiency',
    'max flux',
    'flux dissipation',
    'max speed',
    'ordnance points',
    'fleet pts',
    'fighter bays',
    'cargo',
    'fuel',
    'min crew',
    'max crew',
    'tags',
  ],
  weapons: [
    'name',
    'id',
    'type',
    'range',
    'damage/shot',
    'damage/second',
    'emp',
    'OPs',
    'proj speed',
    'ammo',
    'ammo/sec',
    'reload size',
    'energy/shot',
    'energy/second',
    'chargeup',
    'chargedown',
    'burst size',
    'burst delay',
    'min spread',
    'max spread',
    'beam speed',
    'launch speed',
    'flight time',
    'hints',
    'tags',
  ],
  wings: ['id', 'variant', 'tags', 'op cost', 'num', 'role', 'role desc', 'refit', 'formation', 'range'],
  hullmods: [
    'name',
    'id',
    'tier',
    'tags',
    'uiTags',
    'cost_frigate',
    'cost_dest',
    'cost_cruiser',
    'cost_capital',
    'script',
    'desc',
    'short',
    'sModDesc',
    'sprite',
  ],
  shipSystems: [
    'name',
    'id',
    'flux/second',
    'f/s (base rate)',
    'f/s (base cap)',
    'flux/use',
    'f/u (base rate)',
    'f/u (base cap)',
    'cr/u',
    'max uses',
    'regen',
    'charge up',
    'active',
    'down',
    'cooldown',
    'toggle',
    'noDissipation',
    'noHardDissipation',
    'hardFlux',
    'noFiring',
    'noTurning',
    'noStrafing',
    'noAccel',
    'noShield',
    'noVent',
    'isPhaseCloak',
    'tags',
    'icon',
  ],
  industries: ['name', 'id', 'build time', 'upkeep', 'tags', 'desc', 'order'],
  skills: ['id', 'name', 'icon', 'description', 'aptitude', 'tier', 'tags'],
  abilities: ['name', 'id', 'type', 'tags', 'icon', 'desc', 'sortOrder', 'unlockedAtStart', 'defaultForAIFleet'],
  commodities: ['name', 'id', 'icon', 'price', 'order', 'econUnit', 'tags'],
  specialItems: [
    'name',
    'id',
    'tags',
    'tech/manufacturer',
    'rarity',
    'base price',
    'stack size',
    'cargo space',
    'baseRaidDanger',
    'icon',
    'plugin',
    'plugin params',
    'desc',
    'order',
  ],
  submarkets: ['id', 'name', 'faction', 'desc', 'script', 'icon', 'order'],
  marketConditions: ['name', 'id', 'tags', 'planetary', 'decivRemove', 'script', 'desc', 'icon', 'order'],
  simOpponents: ['variant id'],
  descriptions: ['id', 'type', 'text1', 'text2', 'text3', 'text4', 'text5', 'notes'],
};

// Import CSV_COLUMN_SCHEMAS from csv-column-schema.ts
import { CSV_COLUMN_SCHEMAS } from '@/domain/tables/csv-column-schema';

interface ValidationResult {
  table: TableKey;
  status: 'OK' | 'ERROR' | 'WARNING';
  totalColumns: number;
  missingLabels: string[];
  missingFromSchema: string[];
  extraInSchema: string[];
  details: string[];
}

function validateTable(table: TableKey): ValidationResult {
  const result: ValidationResult = {
    table,
    status: 'OK',
    totalColumns: 0,
    missingLabels: [],
    missingFromSchema: [],
    extraInSchema: [],
    details: [],
  };

  const visibleColumns = TABLE_COLUMNS[table] || [];
  const schemas = CSV_COLUMN_SCHEMAS[table] || [];
  const schemaMap = new Map(schemas.map((s) => [s.key, s]));

  result.totalColumns = visibleColumns.length;

  // Check each visible column
  for (const col of visibleColumns) {
    const schema = schemaMap.get(col);
    if (!schema) {
      result.missingFromSchema.push(col);
      result.status = 'ERROR';
    } else if (!schema.label) {
      result.missingLabels.push(col);
      result.status = 'ERROR';
    }
  }

  // Check for extra columns in schema not in TABLE_COLUMNS
  const visibleSet = new Set(visibleColumns);
  for (const schema of schemas) {
    if (!visibleSet.has(schema.key)) {
      result.extraInSchema.push(schema.key);
      result.details.push(`Extra in schema: ${schema.key} (${schema.label || 'NO LABEL'})`);
    }
  }

  // Generate details
  if (result.missingLabels.length > 0) {
    result.details.push(`Missing labels: ${result.missingLabels.join(', ')}`);
  }
  if (result.missingFromSchema.length > 0) {
    result.details.push(`Missing from schema: ${result.missingFromSchema.join(', ')}`);
  }

  return result;
}

function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Column Localization Verification Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: ValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Validate all tables
  const tables = Object.keys(TABLE_COLUMNS) as TableKey[];
  for (const table of tables) {
    const result = validateTable(table);
    results.push(result);

    if (result.status === 'ERROR') totalErrors++;
    if (result.status === 'WARNING') totalWarnings++;
  }

  // Display results
  for (const result of results) {
    const statusIcon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌';

    console.log(`${statusIcon} ${result.table}`);
    console.log(`   Columns: ${result.totalColumns}`);

    if (result.details.length > 0) {
      for (const detail of result.details) {
        console.log(`   • ${detail}`);
      }
    }

    console.log();
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Tables: ${results.length}`);
  console.log(`✅ OK: ${results.filter((r) => r.status === 'OK').length}`);
  console.log(`⚠️ Warnings: ${totalWarnings}`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (totalErrors > 0) {
    console.log('❌ VALIDATION FAILED - Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - All columns are properly localized!');
    process.exit(0);
  }
}

main();
