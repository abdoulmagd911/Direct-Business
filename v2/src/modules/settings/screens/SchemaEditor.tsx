'use client';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/ui/Checkbox';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import type { SettingSchema } from '../schema';

/** The word for an enum value: the setting's own list in the catalog, else a shared list, else the value itself. */
export function useValueWords(settingKey: string) {
  const t = useTranslations();
  return (v: unknown): string => {
    if (typeof v === 'boolean') return t(`settings.setting.values.${v}`);
    if (typeof v === 'number') return String(v);
    if (typeof v !== 'string') return JSON.stringify(v);
    for (const k of [`settings.values.${settingKey}.${v}`, `theme.${v}`, `density.${v}`, `profile.notify.${v}`])
      if (t.has(k)) return t(k);
    return v;
  };
}

/** A value as words, for the card and the preview: lists joined, objects as "key value" pairs. */
export function SchemaValue({ settingKey, value }: { settingKey: string; value: unknown }) {
  const word = useValueWords(settingKey);
  if (Array.isArray(value)) return <>{value.length ? value.map(word).join(' · ') : '—'}</>;
  if (value && typeof value === 'object')
    return (
      <>
        {Object.entries(value as Record<string, unknown>)
          .map(([k, v]) => `${k} ${word(v)}`)
          .join(' · ')}
      </>
    );
  return <>{word(value)}</>;
}

/** The control for one schema: switch, select, number, text, a checklist for enum arrays, one line each for string arrays. */
export function SchemaEditor({
  settingKey,
  schema,
  value,
  onChange,
  label,
  id,
}: {
  settingKey: string;
  schema: SettingSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  label: string;
  id?: string;
}) {
  const word = useValueWords(settingKey);
  if (schema.type === 'boolean')
    return <Switch id={id} checked={value === true} onCheckedChange={onChange} label={label} />;
  if (schema.enum)
    return (
      <Select
        id={id}
        value={String(value ?? '')}
        onValueChange={(v) => onChange(typeof schema.enum![0] === 'number' ? Number(v) : v)}
        options={schema.enum.map((e) => ({ value: String(e), label: word(e) }))}
      />
    );
  if (schema.type === 'integer' || schema.type === 'number')
    return (
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={schema.minimum}
        max={schema.maximum}
        step={schema.type === 'integer' ? 1 : 'any'}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="max-w-40 font-data"
      />
    );
  if (schema.type === 'array' && schema.items?.enum) {
    const list = Array.isArray(value) ? (value as (string | number)[]) : [];
    return (
      <ul className="flex flex-col gap-2" role="group" aria-label={label}>
        {schema.items.enum.map((e) => (
          <li key={String(e)} className="flex items-center gap-2.5">
            <Checkbox
              checked={list.includes(e)}
              onCheckedChange={(on) => onChange(on ? [...list, e] : list.filter((x) => x !== e))}
              label={word(e)}
            />
            <span className="text-sm">{word(e)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (schema.type === 'array')
    return (
      <Textarea
        id={id}
        rows={6}
        value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
        onChange={(e) =>
          onChange(
            e.target.value
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        className="font-data"
      />
    );
  if (schema.type === 'object' && schema.properties) {
    const obj = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(schema.properties).map(([k, s]) => (
          <Field key={k} label={k}>
            {(p) => (
              <SchemaEditor
                {...p}
                settingKey={`${settingKey}.${k}`}
                schema={s}
                value={obj[k]}
                onChange={(v) => onChange({ ...obj, [k]: v })}
                label={k}
              />
            )}
          </Field>
        ))}
      </div>
    );
  }
  return (
    <Input
      id={id}
      value={typeof value === 'string' ? value : ''}
      pattern={schema.pattern}
      minLength={schema.minLength}
      maxLength={schema.maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
