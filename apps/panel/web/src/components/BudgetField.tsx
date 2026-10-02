import { copy } from "@wanderlot/core";
import { Checkbox, Field, Range, useCopy } from "@wanderlot/ui";

const COPY = copy({
  es: {
    label: "Tope por persona",
    unlimited: "Sin límite",
    amount: (n: number) => `${n} €`,
    noLimit: "Sin límite de precio",
  },
  en: {
    label: "Limit per person",
    unlimited: "No limit",
    amount: (n: number) => `€${n}`,
    noLimit: "No price limit",
  },
});

export interface BudgetFieldProps {
  // Euros per person; null means no limit.
  value: number | null;
  onChange: (euros: number | null) => void;
  max: number;
}

// The most each person should pay, flights and stay, or no limit at all.
export function BudgetField({ value, onChange, max }: BudgetFieldProps) {
  const t = useCopy(COPY);
  const unlimited = value === null;
  return (
    <Field label={t.label} aside={value === null ? t.unlimited : t.amount(value)}>
      {({ inputId }) => (
        <div className="flex flex-col gap-2.5">
          <Range
            id={inputId}
            min={80}
            max={max}
            step={10}
            value={value ?? max}
            disabled={unlimited}
            aria-disabled={unlimited}
            onChange={(e) => onChange(Number(e.target.value))}
            className={unlimited ? "opacity-40" : undefined}
          />
          <Checkbox label={t.noLimit} checked={unlimited} onChange={(e) => onChange(e.target.checked ? null : Math.min(400, max))} />
        </div>
      )}
    </Field>
  );
}
