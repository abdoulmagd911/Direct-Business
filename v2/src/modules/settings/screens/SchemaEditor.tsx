'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/ui/Checkbox';
import { Field } from '@/ui/Field';
import { Input, Textarea } from '@/ui/Input';
import { Select } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import type { SettingSchema } from '../schema';
import { DAY_PATTERN, keyWord, nameLookup, valueText, valueWord, type ChoiceNames } from '../words';

/** A key in plain words (see keyWord). */
export function useKeyWords() {
  const t = useTranslations();
  return (k: string): string => keyWord(t, k);
}

/** The word for an enum value (see valueWord). */
export function useValueWords(settingKey: string) {
  const t = useTranslations();
  return (v: unknown): string => valueWord(t, settingKey, v);
}

/** A value as words, for the card and the preview (see valueText). */
export function SchemaValue({ settingKey, value, names }: { settingKey: string; value: unknown; names?: ChoiceNames }) {
  const t = useTranslations();
  const locale = useLocale() as 'en' | 'ar';
  return <>{valueText(t, settingKey, value, nameLookup(names, locale), locale)}</>;
}

/** The control for one schema: switch, select, number, text, a checklist for enum arrays, one line each for string arrays. */
export function SchemaEditor({
  settingKey,
  schema,
  value,
  onChange,
  label,
  id,
  names,
}: {
  settingKey: string;
  schema: SettingSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  label: string;
  id?: string;
  /** The entries of the lists some values are keys of (LIST_VALUES): offered by name, never typed as keys. */
  names?: ChoiceNames;
}) {
  const word = useValueWords(settingKey);
  const locale = useLocale() as 'en' | 'ar';
  const keyWords = useKeyWords();
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
  if (schema.type === 'array' && names?.[settingKey]) {
    const list = Array.isArray(value) ? (value as string[]) : [];
    const lookup = nameLookup(names, locale);
    return (
      <ul className="flex flex-col gap-2" role="group" aria-label={label}>
        {names[settingKey]
          .filter((e) => e.active !== false || list.includes(e.key))
          .map((e) => (
            <li key={e.key} className="flex items-center gap-2.5">
              <Checkbox
                checked={list.includes(e.key)}
                onCheckedChange={(on) => onChange(on ? [...list, e.key] : list.filter((x) => x !== e.key))}
                label={lookup(settingKey, e.key) ?? e.key}
              />
              <span className="text-sm">{lookup(settingKey, e.key)}</span>
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
          <Field key={k} label={keyWords(k)}>
            {(p) => (
              <SchemaEditor
                {...p}
                settingKey={`${settingKey}.${k}`}
                schema={s}
                value={obj[k]}
                onChange={(v) => onChange({ ...obj, [k]: v })}
                label={keyWords(k)}
                names={names}
              />
            )}
          </Field>
        ))}
      </div>
    );
  }
  // a day (the day the app went live) is chosen in the date box, never typed as 2026-10-27
  if (schema.type === 'string' && schema.pattern === DAY_PATTERN)
    return (
      <Input
        id={id}
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
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
