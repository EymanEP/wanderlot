// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "../src/App.tsx";
import { mockBackend } from "../src/data/mockBackend.ts";
import { PanelProvider } from "../src/data/store.tsx";

afterEach(cleanup);

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <PanelProvider backend={mockBackend({ tickMs: 2, verifyMs: 2 })}>
          <App />
        </PanelProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("Generar", () => {
  it("starts from the plan and streams a new search in", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    await screen.findByRole("heading", { name: "Nueva búsqueda" });
    expect(screen.getAllByRole("article")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "Generar 12 propuestas" }));
    expect(screen.getByText("Consultando vuelos…")).toBeTruthy();
    expect(await screen.findByText("Búsqueda terminada")).toBeTruthy();
    expect(screen.getByText("12 propuestas")).toBeTruthy();
    // Approved ones keep their decision across a new search.
    expect(screen.getAllByRole("article")).toHaveLength(12);
  });

  it("stretches the highlighted stay with the nights pills", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    await screen.findByRole("heading", { name: "Nueva búsqueda" });
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
    const publish = async () => screen.findByRole("button", { name: /^Publicar/ });
    expect((await publish()).textContent).toBe("Publicar 4 aprobadas");

    await user.click(within(screen.getByRole("article", { name: "Oporto" })).getByRole("button", { name: "Aprobar" }));
    expect((await publish()).textContent).toBe("Publicar 5 aprobadas");

    await user.click(within(screen.getByRole("article", { name: "Praga" })).getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("button", { name: "Descartadas · 3" })).toBeTruthy();

    await user.click(await publish());
    expect(await screen.findByText("5 destinos publicados en el sitio")).toBeTruthy();
  });

  it("offers verification instead of approval for Claude's proposals", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const edi = await screen.findByRole("article", { name: "Edimburgo" });
    expect(within(edi).queryByRole("button", { name: "Aprobar" })).toBeNull();
    expect(within(edi).getByText("Lo escribió Claude")).toBeTruthy();
    await user.click(within(edi).getByRole("button", { name: "ver enlaces" }));
    expect(within(edi).getByRole("link", { name: "Airbnb · Leith" })).toBeTruthy();
    await user.click(within(edi).getByRole("button", { name: "Verificar con la API" }));
    expect(await within(edi).findByRole("button", { name: "Aprobar" })).toBeTruthy();
  });

  it("hides unverified proposals on request", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await user.click(await screen.findByLabelText("Ocultar las que no estén verificadas"));
    expect(screen.queryByRole("article", { name: "Edimburgo" })).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });
});

describe("Revisar · fotos", () => {
  it("picks photos in order from Claude's suggestions and shows the cover", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Lisboa" });
    await user.click(within(card).getByRole("button", { name: "Elegir fotos" }));

    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    // Opens on the first idea research gave for this destination.
    expect(dialog.getByRole("button", { name: "Tranvía en Alfama" }).getAttribute("aria-pressed")).toBe("true");
    const results = await dialog.findAllByRole("button", { name: /Tranvía en Alfama \d/ });
    await user.click(results[2]!);
    await user.click(results[0]!);

    // A new search keeps what's picked.
    await user.click(dialog.getByRole("button", { name: "Belém" }));
    await dialog.findAllByRole("button", { name: /Belém \d/ });
    expect(dialog.getAllByRole("button", { pressed: true }).filter((b) => /Tranvía/.test(b.getAttribute("aria-label") ?? ""))).toHaveLength(2);

    await user.click(dialog.getByRole("button", { name: "Guardar 2 fotos" }));
    expect(await screen.findByText("Lisboa: 2 fotos guardadas")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Fotos · 2" })).toBeTruthy();
    expect(card.querySelector("img")!.getAttribute("alt")).toBe("Tranvía en Alfama 3");
  });
});

describe("Comparativa", () => {
  it("rewrites pros, takes a destination out and opens the vote", async () => {
    const user = userEvent.setup();
    renderAt("/comparativa");
    const bud = await screen.findByRole("article", { name: "Budapest" });
    await user.click(within(bud).getByRole("button", { name: "Reescribir pros y contras" }));
    const pros = within(bud).getByLabelText("A favor · una por línea");
    await user.clear(pros);
    await user.type(pros, "Baños termales al aire libre");
    await user.click(within(bud).getByRole("button", { name: "Guardar" }));
    expect(within(bud).getByText("Baños termales al aire libre")).toBeTruthy();

    await user.click(within(bud).getByLabelText("Entra en la votación"));
    await user.click(screen.getByRole("button", { name: "Enviar las 3 a votación" }));
    const dialog = document.querySelector("dialog")!;
    await user.click(within(dialog).getByRole("button", { name: "Abrir con 3 destinos", hidden: true }));
    const message = (await within(dialog).findByLabelText("Mensaje para el grupo", {}, {})) as HTMLTextAreaElement;
    expect(message.value).toContain("Abierta la votación de Noviembre 2026");
    expect(message.value).toContain("• Laura:");
    expect(await screen.findByText(/Votación abierta hasta el/)).toBeTruthy();
  });
});

describe("Personas", () => {
  it("shows who is in and manages invites and access", async () => {
    const user = userEvent.setup();
    renderAt("/personas");
    expect(await screen.findByText(/4 dentro · 1 con invitación pendiente · 1 sin entrar/)).toBeTruthy();

    const laura = screen.getByRole("listitem", { name: "Laura" });
    const oldLink = within(laura).getByLabelText("Invitación de Laura").textContent;
    await user.click(within(laura).getByRole("button", { name: "Nueva invitación" }));
    expect(await within(screen.getByRole("listitem", { name: "Laura" })).findByText((t) => t.startsWith("https://") && t !== oldLink)).toBeTruthy();

    await user.click(within(screen.getByRole("listitem", { name: "Diego" })).getByRole("button", { name: "Crear invitación" }));
    expect(await within(screen.getByRole("listitem", { name: "Diego" })).findByText("Invitación pendiente")).toBeTruthy();

    await user.click(within(screen.getByRole("listitem", { name: "Marta" })).getByRole("button", { name: "Quitar acceso" }));
    await user.click(within(document.querySelector("dialog")!).getByRole("button", { name: "Quitar acceso", hidden: true }));
    expect(await within(screen.getByRole("listitem", { name: "Marta" })).findByText(/Sin invitar|Invitación caducada/)).toBeTruthy();

    await user.type(screen.getByLabelText("Añadir a alguien"), "Nuria Sanz");
    await user.click(screen.getByRole("button", { name: "Añadir" }));
    expect(await within(await screen.findByRole("listitem", { name: "Nuria Sanz" })).findByText("Sin invitar")).toBeTruthy();
  });

  it("saves the group's name", async () => {
    const user = userEvent.setup();
    renderAt("/personas");
    const name = (await screen.findByDisplayValue("Grupo 51")) as HTMLInputElement;
    expect(name).toBe(screen.getByLabelText("Nombre del grupo"));
    await user.clear(name);
    await user.type(name, "Los de siempre");
    await user.click(within(name.closest("form")!).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Guardado en el sitio")).toBeTruthy();
  });
});

describe("Nuevo plan", () => {
  it("creates a plan and starts on it", async () => {
    const user = userEvent.setup();
    renderAt("/planes/nuevo");
    await user.type(await screen.findByLabelText("Nombre"), "Puente de diciembre");
    await user.click(screen.getByRole("button", { name: "5 noches" }));
    await user.click(screen.getByRole("button", { name: "Crear el plan" }));
    expect(await screen.findByText(/Todavía no hay propuestas para Puente de diciembre/)).toBeTruthy();
    expect(screen.getAllByText(/5 noches/).length).toBeGreaterThan(0);
  });
});
