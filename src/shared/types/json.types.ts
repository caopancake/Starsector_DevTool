export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type RowData = Record<string, JsonValue>;
