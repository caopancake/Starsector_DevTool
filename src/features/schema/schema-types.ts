export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'enum'
  | 'color-rgb'
  | 'color-rgba'
  | 'path-image'
  | 'path'
  | 'string-array'
  | 'tag-select'
  | 'object'
  | 'array-of-object'
  | 'key-value';

export interface FieldSchema {
  key: string;
  type: FieldType;
  label: string;
  description?: string | null;
  required?: boolean | null;
  editable?: boolean | null;
  default?: unknown;
  warning?: string | null;
  danger?: string | null;
  source?: string | null;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  options?: string[] | null;
  nested?: FieldSchema[] | null;
}

export interface SectionSchema {
  id: string;
  label: string;
  collapsed?: boolean;
  fields: FieldSchema[];
}

export type SchemaSourceType = 'csv-row' | 'json-file' | 'text-file';

export interface SchemaSource {
  id: string;
  type: SchemaSourceType;
  path: string;
  keyField?: string;
  extraFields?: boolean;
}

export interface FileSchema {
  $schema?: string;
  id: string;
  fileType?: string;
  displayName?: string;
  description?: string;
  targetFile?: string;
  gameVersion?: string;
  sources?: SchemaSource[];
  sections?: SectionSchema[];
  /** Flat field list — used by bundled schemas that have no sections */
  fields?: FieldSchema[];
}
