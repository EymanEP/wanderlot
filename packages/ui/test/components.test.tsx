// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Calendar, Chip, ProvenanceBadge, Select, Stepper } from "../src/index.ts";

afterEach(cleanup);

const OPTIONS = [
  { value: "any", label: "Cualquiera" },
  { value: "europe", label: "Solo Europa" },
  { value: "place", label: "Destino concreto…" },
] as const;

function SelectHarness() {
  const [v, setV] = useState<(typeof OPTIONS)[number]["value"]>("any");
  return <Select label="Destino" value={v} options={OPTIONS} onChange={setV} />;
}

describe("Select", () => {
  it("opens, picks with the mouse and closes", async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    const button = screen.getByRole("button", { name: "Destino" });
    expect(button).toHaveProperty("textContent", "Cualquiera");
    await user.click(button);
    await user.click(screen.getByRole("option", { name: "Solo Europa" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(button.textContent).toBe("Solo Europa");
  });

  it("works from the keyboard and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<SelectHarness />);
    screen.getByRole("button", { name: "Destino" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("button", { name: "Destino" }).textContent).toBe("Destino concreto…");
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("controls", () => {
  it("Chip reports its pressed state", () => {
    render(<Chip on>7 noches</Chip>);
    expect(screen.getByRole("button", { name: "7 noches" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Stepper stops at its bounds", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [n, setN] = useState(2);
      return <Stepper value={n} onChange={setN} min={1} max={3} unit="viajamos" decrementLabel="Quitar una persona" incrementLabel="Añadir una persona" />;
    }
    render(<Harness />);
    const minus = screen.getByRole("button", { name: "Quitar una persona" }) as HTMLButtonElement;
    await user.click(minus);
    expect(minus.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Añadir una persona" }));
    await user.click(screen.getByRole("button", { name: "Añadir una persona" }));
    expect((screen.getByRole("button", { name: "Añadir una persona" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("ProvenanceBadge says who the numbers come from", () => {
    render(
      <>
        <ProvenanceBadge trust="verified" label="long" />
        <ProvenanceBadge trust="unverified" />
        <ProvenanceBadge trust="stale" label="Verificado hace 5 días" />
      </>,
    );
    expect(screen.getByText("Verificado con la API")).toBeTruthy();
    expect(screen.getByText("Lo escribió Claude")).toBeTruthy();
    expect(screen.getByText("Verificado hace 5 días")).toBeTruthy();
  });

  it("Calendar highlights the range and reports picks", async () => {
    const user = userEvent.setup();
    const picks: string[] = [];
    render(<Calendar year={2026} month0={10} onMonthChange={() => {}} start="2026-11-07" end="2026-11-14" onPick={(d) => picks.push(d)} />);
    const selected = screen.getAllByRole("gridcell").filter((c) => c.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "2026-11-20" }));
    expect(picks).toEqual(["2026-11-20"]);
  });
});
