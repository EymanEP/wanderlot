// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "../src/App.tsx";
import { PanelProvider } from "../src/data/store.tsx";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <PanelProvider tickMs={5}>
          <App />
        </PanelProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("Generar", () => {
  it("streams the rest of the mock proposals in", async () => {
    renderAt("/generar");
    expect(screen.getByText("Consultando vuelos…")).toBeTruthy();
    expect(await screen.findByText("Búsqueda terminada")).toBeTruthy();
    expect(screen.getByText("12 / 12")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(12);
  });

  it("stretches the highlighted stay with the nights pills", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    expect(screen.getAllByText(/7 – 14 nov · 7 noches/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "10 noches" }));
    expect(screen.getAllByText(/7 – 17 nov · 10 noches/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "2026-11-20" }));
    expect(screen.getAllByText(/20 – 30 nov · 10 noches/).length).toBeGreaterThan(0);
  });
});

describe("Revisar", () => {
  it("approves, discards and publishes", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const publish = () => screen.getByRole("button", { name: /^Publicar/ });
    expect(publish().textContent).toBe("Publicar 4 aprobadas");

    const oporto = screen.getByRole("article", { name: "Oporto" });
    await user.click(within(oporto).getByRole("button", { name: "Aprobar" }));
    expect(publish().textContent).toBe("Publicar 5 aprobadas");

    await user.click(within(screen.getByRole("article", { name: "Praga" })).getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("button", { name: "Descartadas · 3" })).toBeTruthy();

    await user.click(publish());
    expect(await screen.findByText("5 destinos publicados en el sitio (simulado)")).toBeTruthy();
  });

  it("offers verification instead of approval for Claude's proposals", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const edi = screen.getByRole("article", { name: "Edimburgo" });
    expect(within(edi).queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(within(edi).getByText("Lo escribió Claude")).toBeTruthy();
    await user.click(within(edi).getByRole("button", { name: "ver enlaces" }));
    expect(within(edi).getByRole("link", { name: "Airbnb · Leith" })).toBeTruthy();
  });

  it("hides unverified proposals on request", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await user.click(screen.getByLabelText("Ocultar las que no estén verificadas"));
    expect(screen.queryByRole("article", { name: "Edimburgo" })).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });
});

describe("Comparativa", () => {
  it("rewrites pros and takes a destination out of the vote", async () => {
    const user = userEvent.setup();
    renderAt("/comparativa");
    const bud = screen.getByRole("article", { name: "Budapest" });
    await user.click(within(bud).getByRole("button", { name: "Reescribir pros y contras" }));
    const pros = within(bud).getByLabelText("A favor · una por línea");
    await user.clear(pros);
    await user.type(pros, "Baños termales al aire libre");
    await user.click(within(bud).getByRole("button", { name: "Guardar" }));
    expect(within(bud).getByText("Baños termales al aire libre")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Enviar las 4 a votación" })).toBeTruthy();
    await user.click(within(bud).getByLabelText("Entra en la votación"));
    expect(screen.getByRole("button", { name: "Enviar las 3 a votación" })).toBeTruthy();
  });
});

describe("Personas", () => {
  it("shows who is in and manages invites and access", async () => {
    const user = userEvent.setup();
    renderAt("/personas");
    expect(screen.getByText(/4 dentro · 1 con invitación pendiente · 1 sin entrar/)).toBeTruthy();

    const laura = screen.getByRole("listitem", { name: "Laura" });
    expect(within(laura).getByText("Invitación pendiente")).toBeTruthy();
    const oldLink = within(laura).getByLabelText("Invitación de Laura").textContent;
    await user.click(within(laura).getByRole("button", { name: "Nueva invitación" }));
    expect(within(laura).getByLabelText("Invitación de Laura").textContent).not.toBe(oldLink);

    const diego = screen.getByRole("listitem", { name: "Diego" });
    expect(within(diego).getByText("Invitación caducada")).toBeTruthy();
    await user.click(within(diego).getByRole("button", { name: "Crear invitación" }));
    expect(within(diego).getByText("Invitación pendiente")).toBeTruthy();

    const marta = screen.getByRole("listitem", { name: "Marta" });
    await user.click(within(marta).getByRole("button", { name: "Quitar acceso" }));
    await user.click(within(document.querySelector("dialog")!).getByRole("button", { name: "Quitar acceso", hidden: true }));
    expect(within(marta).getByText(/Sin invitar|Invitación caducada/)).toBeTruthy();

    await user.type(screen.getByLabelText("Añadir a alguien"), "Nuria Sanz");
    await user.click(screen.getByRole("button", { name: "Añadir" }));
    const nuria = screen.getByRole("listitem", { name: "Nuria Sanz" });
    expect(within(nuria).getByText("Sin invitar")).toBeTruthy();
  });
});
