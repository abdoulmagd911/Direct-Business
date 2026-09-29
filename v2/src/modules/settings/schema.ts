/** The subset of JSON Schema the registry writes (core.json_check, V131): what a setting's editor has to draw. */
export type SettingSchema = {
  type?: 'boolean' | 'string' | 'number' | 'integer' | 'array' | 'object';
  enum?: (string | number)[];
  const?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  items?: SettingSchema;
  properties?: Record<string, SettingSchema>;
  required?: string[];
};

export type SettingDefRow = {
  key: string;
  label_key: string;
  schema: SettingSchema;
  default: unknown;
  effective_dated: boolean;
  /** Today's value for the whole of Direct (the department rows are apart). */
  value: unknown;
  rows: SettingRow[];
};

export type SettingRow = {
  id: string;
  department_id: string | null;
  value: unknown;
  valid_from: string;
  reason: string | null;
  set_by: string | null;
  set_at: string;
};

export type SettingsAnswer = { can_edit: boolean; settings: SettingDefRow[] };

/** Does the value satisfy the schema? The database checks too (JSON-01); this only keeps Save disabled until it would. */
export function valid(schema: SettingSchema, value: unknown): boolean {
  if (schema.const !== undefined) return JSON.stringify(value) === JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.includes(value as string | number);
  switch (schema.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) return false;
      if (schema.type === 'integer' && !Number.isInteger(value)) return false;
      if (schema.minimum !== undefined && value < schema.minimum) return false;
      if (schema.maximum !== undefined && value > schema.maximum) return false;
      return true;
    case 'string':
      if (typeof value !== 'string') return false;
      if (schema.minLength !== undefined && value.length < schema.minLength) return false;
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return false;
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) return false;
      return true;
    case 'array':
      if (!Array.isArray(value)) return false;
      if (schema.minItems !== undefined && value.length < schema.minItems) return false;
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return false;
      return schema.items ? value.every((v) => valid(schema.items!, v)) : true;
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
      const v = value as Record<string, unknown>;
      for (const r of schema.required ?? []) if (!(r in v)) return false;
      for (const [k, s] of Object.entries(schema.properties ?? {})) if (k in v && !valid(s, v[k])) return false;
      return true;
    }
    default:
      return true;
  }
}
