// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { Plan } from "@wanderlot/core";
import { DestinationCard } from "../src/components/DestinationCard.tsx";
import { destination, snapshot } from "../../../../packages/core/test/fixtures.ts";

afterEach(cleanup);

const photo = {
  url: "https://upload.wikimedia.org/wikipedia/commons/lisboa.jpg",
  source: "wikimedia" as const,
  author: "Ana",
  license: "CC BY-SA 4.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Lisboa.jpg",
  alt: "Tranvía en Alfama",
};

function card(photos: (typeof photo)[]) {
  const d = destination("lis", { photos });
  const plan = { ...snapshot([d]).plan, status: "voting" } as Plan;
  render(
    <MemoryRouter>
      <DestinationCard destination={d} plan={plan} href="/p/x/destinos/lis" trust="verified" myPosition={-1} saved={false} onToggleSave={() => {}} />
    </MemoryRouter>,
  );
}

describe("DestinationCard", () => {
  it("shows the cover photo the organiser picked", () => {
    card([photo]);
    const img = screen.getByRole("img", { name: "Tranvía en Alfama" }) as HTMLImageElement;
    expect(img.src).toBe(photo.url);
  });

  it("shows a placeholder until photos are picked", () => {
    card([]);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("[Foto de lis]")).toBeTruthy();
  });
});
