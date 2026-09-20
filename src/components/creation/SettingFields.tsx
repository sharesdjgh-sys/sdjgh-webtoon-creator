"use client";
import { Textarea } from "@/components/ui/textarea";
type Field = { key: string; label: string; hint: string };
export default function SettingFields({ fields, values, onChange }: {
  fields: readonly Field[]; values: Record<string, string | undefined>;
  onChange: (key: string, value: string) => void;
}) {
  return <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => (
    <label key={field.key} className="block text-xs font-semibold text-[#393347]">
      {field.label}<span className="mt-1 mb-2 block text-[11px] font-normal leading-5 text-[#82798B]">{field.hint}</span>
      <Textarea value={values[field.key] ?? ""} onChange={e => onChange(field.key, e.target.value)} rows={3} maxLength={3000} />
    </label>
  ))}</div>;
}
