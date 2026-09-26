import { Field, TextInput } from "@wanderlot/ui";

export interface PinFieldProps {
  label: string;
  value: string;
  onChange: (pin: string) => void;
  // "new-password" when choosing it, so password managers offer to save it.
  autoComplete: "new-password" | "current-password";
  autoFocus?: boolean;
  // 4 digits; 6 only to sign in with a PIN chosen before the switch to 4.
  length?: 4 | 6;
}

// Four digits, with the phone's number pad.
export function PinField({ label, value, onChange, autoComplete, autoFocus, length = 4 }: PinFieldProps) {
  return (
    <Field label={label}>
      {({ inputId }) => (
        <TextInput
          id={inputId}
          type="password"
          inputMode="numeric"
          pattern={`[0-9]{${length}}`}
          maxLength={length}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          className="text-center text-[22px] tracking-[0.5em] tabular-nums"
        />
      )}
    </Field>
  );
}
