import { Field, TextInput } from "@wanderlot/ui";

export interface PinFieldProps {
  label: string;
  value: string;
  onChange: (pin: string) => void;
  // "new-password" when choosing it, so password managers offer to save it.
  autoComplete: "new-password" | "current-password";
  autoFocus?: boolean;
}

// Six digits, with the phone's number pad.
export function PinField({ label, value, onChange, autoComplete, autoFocus }: PinFieldProps) {
  return (
    <Field label={label}>
      {({ inputId }) => (
        <TextInput
          id={inputId}
          type="password"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-[22px] tracking-[0.5em] tabular-nums"
        />
      )}
    </Field>
  );
}
