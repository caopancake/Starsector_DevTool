import { frontendFile, singleFileByRel } from '../shared/files.mjs';

export const editModeBoundaryRule = {
  name: 'edit-mode-boundary',
  check(files) {
    const failures = [];
    const schemaTypesFile = singleFileByRel(files, 'src/domain/schema/schema.types.ts');
    const csvColumnSchemaFile = files.find(isCsvColumnSchemaModule);
    const schemaTypes = requiredStringUnionMembers(schemaTypesFile, 'FieldType');
    const csvControls = requiredStringUnionMembers(csvColumnSchemaFile, 'CsvColumnControl');
    const schemaRenderers = files.filter(isSchemaFieldRenderer);
    const csvStaticCells = files.filter(isCsvStaticRenderer);
    const csvEditorOverlays = files.filter(isCsvEditorOverlay);

    if (schemaRenderers.length === 0) failures.push(`schema field renderer: schema edit mode boundary has no renderer host`);
    if (csvStaticCells.length === 0) failures.push(`CSV static renderer: CSV edit mode boundary has no static renderer host`);
    if (csvEditorOverlays.length === 0) failures.push(`CSV editor overlay: CSV edit mode boundary has no editor overlay host`);

    for (const schemaRenderer of schemaRenderers) {
      for (const type of schemaTypes) {
        if (!schemaRenderer.text.includes(`field.type === '${type}'`)) {
          failures.push(`${schemaRenderer.rel}: edit mode renderer does not cover schema field type '${type}'`);
        }
      }
      const plainBranch = templateBranch(schemaRenderer.text, 'v-if="plainMode"', '<template v-else>');
      const smartBranch = templateBranch(schemaRenderer.text, '<template v-else>', '<!-- Warning text -->');
      if (containsEnhancedControlMarkup(plainBranch)) {
        failures.push(`${schemaRenderer.rel}: plain edit mode branch must not render enhanced widgets`);
      }
      if (!containsEnhancedControlMarkup(smartBranch)) {
        failures.push(`${schemaRenderer.rel}: smart edit mode branch must retain enhanced widgets`);
      }
    }

    for (const csvStaticCell of csvStaticCells) {
      if (!csvStaticCell.text.includes('csv-static-${control}')) {
        failures.push(`${csvStaticCell.rel}: CSV static renderer must derive display class from CSV control`);
      }
      const plainBranch = templateBranch(csvStaticCell.text, 'v-if="plainMode"', '<template v-else-if=');
      if (containsReferenceDisplayMarkup(plainBranch)) {
        failures.push(`${csvStaticCell.rel}: plain edit mode branch must not render reference decorations`);
      }
    }

    for (const csvEditorOverlay of csvEditorOverlays) {
      for (const control of csvControls) {
        if (control === 'text') continue;
        if (!csvEditorOverlay.text.includes(`column.schema?.control === '${control}'`)) {
          failures.push(`${csvEditorOverlay.rel}: CSV editor overlay does not cover CSV control '${control}'`);
        }
      }
      const plainBranch = templateBranch(csvEditorOverlay.text, 'v-if="plainMode"', '<template v-else>');
      const smartBranch = templateBranch(csvEditorOverlay.text, '<template v-else>', '</template>');
      if (containsEnhancedControlMarkup(plainBranch)) {
        failures.push(`${csvEditorOverlay.rel}: plain edit mode branch must not render enhanced widgets`);
      }
      if (!containsEnhancedControlMarkup(smartBranch)) {
        failures.push(`${csvEditorOverlay.rel}: smart edit mode branch must retain enhanced widgets`);
      }
    }

    for (const file of files) {
      if (!frontendFile(file.rel)) continue;
      if (isSettingsStore(file)) continue;
      if (definesEditModeState(file.text) && !isSettingsStore(file)) {
        failures.push(`${file.rel}: edit mode state must only be defined in settings store`);
      }
      if (readsEditMode(file.text) && !hasModeBranch(file.text)) {
        failures.push(`${file.rel}: files that read edit mode must contain an explicit plain/smart render branch`);
      }
      if (
        containsEnhancedControlMarkup(file.text) &&
        containsTemplatePlainBranch(file.text) &&
        containsEnhancedControlMarkup(templateBranch(file.text, 'v-if="plainMode"', '<template v-else>'))
      ) {
        failures.push(`${file.rel}: plain edit mode branch must not render enhanced widgets`);
      }
    }

    return failures;
  },
};

function isSchemaFieldRenderer(file) {
  return file.rel.endsWith('.vue') && file.text.includes('defineProps') && file.text.includes('field: FieldSchema');
}

function isCsvColumnSchemaModule(file) {
  return file.rel.startsWith('src/domain/tables/') && file.rel.endsWith('.ts') && file.text.includes('export type CsvColumnControl');
}

function isCsvStaticRenderer(file) {
  return (
    file.rel.endsWith('.vue') &&
    file.text.includes('csv-static-control') &&
    file.text.includes('column: CsvGridColumn') &&
    file.text.includes('staticClass')
  );
}

function isCsvEditorOverlay(file) {
  return file.rel.endsWith('.vue') && file.text.includes('csv-cell-editor-overlay') && file.text.includes('column: CsvGridColumn');
}

function requiredStringUnionMembers(file, typeName) {
  if (!file) return [];
  const match = file.text.match(new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`));
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function templateBranch(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  if (start < 0) return '';
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  return end < 0 ? text.slice(start) : text.slice(start, end);
}

function containsEnhancedControlMarkup(text) {
  return /<n-select\b|<ColorPicker\b|renderSelectLabel|renderGraphicsLabel|schema-select-option/.test(text);
}

function containsReferenceDisplayMarkup(text) {
  return /csv-static-tag|csv-static-thumb|schema-select-option|renderSelectLabel/.test(text);
}

function isSettingsStore(file) {
  return (
    file.rel.startsWith('src/stores/') &&
    file.rel.endsWith('.store.ts') &&
    file.text.includes('defineStore') &&
    file.text.includes('settings')
  );
}

function definesEditModeState(text) {
  return /ref<EditMode>|ref\(['"](?:plain|smart)['"]\)|const\s+EDIT_MODE_KEY|type\s+EditMode\s*=/.test(text);
}

function readsEditMode(text) {
  return /isPlainEditMode|editMode\s*===\s*['"]smart['"]|editMode\s*===\s*['"]plain['"]/.test(text);
}

function hasModeBranch(text) {
  return /v-if="[^"]*isPlainEditMode|v-if="plainMode"|v-else|editMode\s*===\s*['"]smart['"]/.test(text);
}

function containsTemplatePlainBranch(text) {
  return text.includes('v-if="plainMode"') || text.includes('v-if="settings.isPlainEditMode"');
}
