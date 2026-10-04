// @vitest-environment jsdom
// Getting to the departure airport, as the destination page shows it (ROADMAP 2.3).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocaleProvider } from "@wanderlot/ui";
import { AccessRow } from "../src/components/DestinationParts.tsx";

afterEach(cleanup);

const access = { home: "Logroño", mode: "car" as const, title: "Coche hasta Bilbao, 2 coches", minutes: 110, cents: 3200 };

describe("AccessRow", () => {
  it("says it's an estimate until the organiser checks it", () => {
    render(<AccessRow access={access} airport="BIO" />);
    expect(screen.getByText("Hasta BIO")).toBeTruthy();
    expect(screen.getByText("Coche hasta Bilbao, 2 coches · 1 h 50 m")).toBeTruthy();
    expect(screen.getByText("Desde Logroño, ida y vuelta")).toBeTruthy();
    expect(screen.getByText(/^≈ 32\s€$/)).toBeTruthy();
    expect(screen.getByText("por persona · aproximado")).toBeTruthy();
  });

  it("drops the estimate once checked, in English too", () => {
    render(
      <LocaleProvider locale="en">
        <AccessRow access={{ ...access, checked: true }} airport="BIO" />
      </LocaleProvider>,
    );
    expect(screen.getByText("To BIO")).toBeTruthy();
    expect(screen.getByText("From Logroño, there and back")).toBeTruthy();
    expect(screen.getByText("€32")).toBeTruthy();
    expect(screen.getByText("per person")).toBeTruthy();
  });
});
