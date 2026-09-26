import { Checkbox, Field, Range } from "@wanderlot/ui";

export interface BudgetFieldProps {
  // Euros per person; null means no limit.
  value: number | null;
  onChange: (euros: number | null) => void;
  max: number;
}

// The most each person should pay, flights and stay, or no limit at all.
export function BudgetField({ value, onChange, max }: BudgetFieldProps) {
  const unlimited = value === null;
  return (
    <Field label="Tope por persona" aside={unlimited ? "Sin límite" : `${value} €`}>
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
          <Checkbox label="Sin límite de precio" checked={unlimited} onChange={(e) => onChange(e.target.checked ? null : Math.min(400, max))} />
        </div>
      )}
    </Field>
  );
}
