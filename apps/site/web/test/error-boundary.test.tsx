// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { PageErrorBoundary } from "../src/components/PageErrorBoundary.tsx";

afterEach(cleanup);

function Broken(): never {
  throw new Error("destinations is undefined");
}

describe("PageErrorBoundary", () => {
  it("shows what failed instead of a blank page, and clears on the next page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/roto"]}>
        <Link to="/bien">Otra pestaña</Link>
        <PageErrorBoundary>
          <Routes>
            <Route path="/roto" element={<Broken />} />
            <Route path="/bien" element={<p>Todo en orden</p>} />
          </Routes>
        </PageErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("Algo ha fallado al mostrar esta página")).toBeTruthy();
    expect(screen.getByText("destinations is undefined")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recargar" })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Otra pestaña" }));
    expect(screen.getByText("Todo en orden")).toBeTruthy();
    vi.restoreAllMocks();
  });
});
