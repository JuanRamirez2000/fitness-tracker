import type { FieldValues, Path, useForm } from "react-hook-form";
import type { FieldSpec } from "@/lib/dashboard/table-tab";

export const fieldInputClass =
  "w-full rounded-[9px] border border-field-border bg-inset px-[13px] py-[11px] text-[13.5px] text-ink outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/13";

/** One input per FieldSpec kind, wired to a react-hook-form register() — shared by the form
 * dialog and the inline add-row, so the two never drift out of sync with each other.
 *
 * `field.name as Path<Values>`: RHF's Path<T> is a template-literal/conditional type that
 * does not reduce under a generic type parameter, so TS cannot itself prove our flat
 * `keyof Values & string` extends it — true for every concrete Values this ever runs with,
 * just not provable generically. This assertion is RHF's own documented way around that,
 * not a real type hole (every FieldSpec.name is already checked against its own Values by
 * the TableTab that built it).
 */
export function FieldInput<Values extends FieldValues>({
  field,
  register,
  className = fieldInputClass,
}: {
  field: FieldSpec<Values>;
  register: ReturnType<typeof useForm<Values>>["register"];
  className?: string;
}) {
  const name = field.name as Path<Values>;

  switch (field.kind) {
    case "date":
      return <input type="date" className={className} {...register(name)} />;
    case "number":
      return (
        <input
          type="number"
          step={field.step ?? 1}
          className={className}
          {...register(name, {
            setValueAs: (v) => (v === "" || v === null ? null : Number(v)),
          })}
        />
      );
    case "select":
      return (
        <select className={className} {...register(name)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "text":
      return field.multiline ? (
        <textarea rows={2} className={className} {...register(name, { setValueAs: (v) => (v === "" ? null : v) })} />
      ) : (
        <input type="text" className={className} {...register(name, { setValueAs: (v) => (v === "" ? null : v) })} />
      );
  }
}
