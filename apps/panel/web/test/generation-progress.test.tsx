// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { GenerationProgress } from "../src/components/GenerationProgress.tsx";
import type { GenerationState } from "../src/data/store.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base: GenerationState = {
  running: true,
  received: 0,
  requested: 12,
  stopped: false,
  error: null,
  source: "claude",
  startedAt: 0,
  steps: [],
  idea: null,
};

describe("GenerationProgress", () => {
  it("shows the time, the current step, what it looked at and a way to stop", () => {
    vi.useFakeTimers({ now: 125_000 });
    const onStop = vi.fn();
    render(
      <GenerationProgress
        generation={{
          ...base,
          received: 1,
          steps: [
            { kind: "note", text: "Busco vuelos desde Madrid." },
            { kind: "search", query: "vuelos Madrid Lisboa" },
            { kind: "read", host: "skyscanner.es", url: "https://www.skyscanner.es/x" },
            { kind: "search", query: "hoteles Lisboa noviembre" },
          ],
        }}
        onStop={onStop}
      />,
    );
    const card = screen.getByRole("region", { name: "Búsqueda en curso" });
    expect(within(card).getByRole("heading", { name: "Claude está buscando destinos" })).toBeTruthy();
    expect(within(card).getByLabelText("Tiempo buscando").textContent).toBe("2:05");
    expect(within(card).getByText("Buscando «hoteles Lisboa noviembre»")).toBeTruthy();
    expect(within(card).getByText("2 búsquedas · 1 página leída · 1 propuesta")).toBeTruthy();
    const earlier = within(card).getByRole("list", { name: "Pasos anteriores" });
    expect(within(earlier).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Leyendo skyscanner.es",
      "Buscando «vuelos Madrid Lisboa»",
      "Busco vuelos desde Madrid.",
    ]);
    within(card).getByRole("button", { name: "Detener" }).click();
    expect(onStop).toHaveBeenCalled();
  });

  it("names the idea being researched, and says it's starting before any step", () => {
    render(<GenerationProgress generation={{ ...base, startedAt: Date.now(), idea: "Azores" }} onStop={() => {}} />);
    expect(screen.getByRole("heading", { name: "Investigando Azores" })).toBeTruthy();
    expect(screen.getByText("Empezando…")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Pasos anteriores" })).toBeNull();
  });
});
