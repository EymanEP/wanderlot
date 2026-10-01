// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

function renderAt(path: string, tickMs = 2) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <PanelProvider backend={mockBackend({ tickMs, verifyMs: 2 })}>
          <App />
        </PanelProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("Viajes", () => {
  it("lists every trip, opens one, edits another and deletes a third", async () => {
    const user = userEvent.setup();
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Viajes" })).toBeTruthy();
    const card = (name: string) => screen.getByRole("article", { name });
    await screen.findByRole("article", { name: "Noviembre 2026" });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Puente de mayo 2026", "Semana Santa 2027", "Noviembre 2026"]);
    expect(within(card("Noviembre 2026")).getByText("Borrador")).toBeTruthy();
    expect(within(card("Puente de mayo 2026")).getByText("Votación cerrada")).toBeTruthy();
    expect(within(card("Noviembre 2026")).getByText("Abierto")).toBeTruthy();
    expect(within(card("Noviembre 2026")).getByText(/12 propuestas · 4 aprobadas/)).toBeTruthy();
    expect(within(card("Semana Santa 2027")).getByText("Borrador")).toBeTruthy();

    // Editing a trip that isn't open leaves the open one alone.
    await user.click(within(card("Semana Santa 2027")).getByRole("button", { name: "Editar" }));
    const dialog = () => within(document.querySelector("dialog[open]") as HTMLElement);
    const name = dialog().getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Pascua 2027");
    await user.click(dialog().getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("article", { name: "Pascua 2027" })).toBeTruthy();
    expect(within(card("Noviembre 2026")).getByText("Abierto")).toBeTruthy();

    // Deleting asks first.
    await user.click(within(card("Puente de mayo 2026")).getByRole("button", { name: "Borrar" }));
    expect(dialog().getByText(/No se puede deshacer/)).toBeTruthy();
    await user.click(dialog().getByRole("button", { name: "Borrar viaje" }));
    expect(await screen.findByText("Puente de mayo 2026 borrado")).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Puente de mayo 2026" })).toBeNull();

    // Opening one with proposals goes to Revisar.
    await user.click(within(card("Noviembre 2026")).getByRole("button", { name: "Abrir" }));
    expect(await screen.findByRole("button", { name: /^Publicar/ })).toBeTruthy();
  });
});

describe("Viajes · exportar", () => {
  it("downloads one published trip or all of them as JSON", async () => {
    const saved: { name: string; data: any }[] = [];
    const create = URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    let blob: Blob | null = null;
    URL.createObjectURL = (b: Blob) => ((blob = b), "blob:export");
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, data: blob });
    };
    try {
      const user = userEvent.setup();
      renderAt("/");
      const closed = await screen.findByRole("article", { name: "Puente de mayo 2026" });
      // Only what's on the site can be exported.
      expect(within(screen.getByRole("article", { name: "Semana Santa 2027" })).queryByRole("button", { name: "Exportar" })).toBeNull();
      await user.click(within(closed).getByRole("button", { name: "Exportar" }));
      expect(await screen.findByText("Puente de mayo 2026 exportado")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Exportar todo" }));
      expect(await screen.findByText("Viajes exportados")).toBeTruthy();

      expect(saved.map((s) => s.name)).toEqual([expect.stringMatching(/^wanderlot-.+-\d{4}-\d\d-\d\d\.json$/), expect.stringMatching(/^wanderlot-viajes-/)]);
      const data = JSON.parse(await (saved[1]!.data as Blob).text());
      expect(data).toMatchObject({ format: "wanderlot-export", version: 1 });
      expect(data.trips.map((t: any) => t.plan.name)).toEqual(["Puente de mayo 2026"]);
    } finally {
      URL.createObjectURL = create;
      HTMLAnchorElement.prototype.click = click;
    }
  });
});

describe("Panel en el móvil", () => {
  it("turns on the panel at /admin with a password typed twice", async () => {
    const user = userEvent.setup();
    renderAt("/personas");
    const card = await screen.findByRole("region", { name: "Panel en el móvil" });
    expect(await within(card).findByText("Desactivado")).toBeTruthy();
    await user.type(within(card).getByLabelText("Contraseña"), "corta");
    await user.type(within(card).getByLabelText("Repítela"), "corta");
    await user.click(within(card).getByRole("button", { name: "Activar" }));
    expect(within(card).getByRole("alert").textContent).toBe("Usa al menos 10 caracteres");
    await user.clear(within(card).getByLabelText("Contraseña"));
    await user.clear(within(card).getByLabelText("Repítela"));
    await user.type(within(card).getByLabelText("Contraseña"), "una contraseña larga");
    await user.type(within(card).getByLabelText("Repítela"), "otra contraseña larga");
    await user.click(within(card).getByRole("button", { name: "Activar" }));
    expect(within(card).getByRole("alert").textContent).toBe("Las dos contraseñas no coinciden");
    await user.clear(within(card).getByLabelText("Repítela"));
    await user.type(within(card).getByLabelText("Repítela"), "una contraseña larga");
    await user.click(within(card).getByRole("button", { name: "Activar" }));
    expect(await within(card).findByText("Activado")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "https://wanderlot-grupo51.workers.dev/admin/" }).getAttribute("href")).toContain("/admin/");
    await user.click(within(card).getByRole("button", { name: "Desactivar" }));
    expect(await within(card).findByText("Desactivado")).toBeTruthy();
  });

  it("says what needs the laptop, or an AI, when the site serves the panel", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/generar"]}>
        <ToastProvider>
          <PanelProvider backend={mockBackend({ tickMs: 2, verifyMs: 2, hosted: true })}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/el sitio necesita una clave de Claude/)).toBeTruthy();
    expect(screen.getByText("sin IA: busca desde tu ordenador")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Generar/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Salir" })).toBeTruthy();
    // Prices are typed: no screenshots without an AI on the site.
    await user.click(within(screen.getByRole("navigation", { name: "Dónde" })).getByRole("link", { name: /^Revisar/ }));
    const card = await screen.findByRole("article", { name: "Cracovia" });
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    expect(dialog.getByText(/Leer capturas necesita una IA/)).toBeTruthy();
    expect(dialog.queryByLabelText("Leer captura del vuelo")).toBeNull();
  });
});

describe("Navigation", () => {
  it("keeps the group's pages on top and each trip's steps in its own bar", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await screen.findByRole("button", { name: /^Publicar/ });
    const top = screen.getAllByRole("navigation", { name: "Panel" })[0]!;
    expect(within(top).getAllByRole("link").map((l) => l.textContent)).toEqual(["Viajes", "Personas", "Ajustes", "Ver sitio"]);

    const steps = screen.getByRole("navigation", { name: "Pasos del viaje" });
    expect(within(steps).getAllByRole("link").map((l) => l.textContent)).toEqual(["1Cuándo", "2Dónde", "3El viaje"]);
    expect(within(steps).getByRole("link", { name: /Dónde/ }).getAttribute("aria-current")).toBe("page");
    // Dónde's own steps, with how many proposals wait for review.
    const donde = screen.getByRole("navigation", { name: "Dónde" });
    expect(within(donde).getAllByRole("link").map((l) => l.textContent)).toEqual(["Generar", "Revisar6", "Comparativa", "Votación"]);
    expect((screen.getByRole("button", { name: "Viaje" }) as HTMLElement).textContent).toContain("Noviembre 2026");

    await user.click(within(steps).getByRole("link", { name: /Cuándo/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Fechas" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Dónde" })).toBeNull();
    // The group's pages have no trip bar.
    await user.click(within(screen.getAllByRole("navigation", { name: "Panel" })[0]!).getByRole("link", { name: "Personas" }));
    await screen.findByRole("heading", { level: 1, name: "Personas" });
    expect(screen.queryByRole("navigation", { name: "Pasos del viaje" })).toBeNull();
  });
});

describe("Fechas", () => {
  it("follows who can go when, chooses, and proposes dates for another trip", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const semana = await screen.findByRole("article", { name: "Semana Santa 2027" });
    await user.click(within(semana).getByRole("button", { name: "Fechas" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Fechas" })).toBeTruthy();

    const table = await screen.findByRole("table", { name: "Quién puede cuándo" });
    const row = (name: string) => within(table).getByRole("row", { name: new RegExp(`^${name}`) });
    expect(within(row("Marta")).getAllByText("Sí")).toHaveLength(2);
    expect(within(row("Marta")).getByText("«El lunes de Pascua trabajo»")).toBeTruthy();
    expect(within(row("Eyman")).getByText("Sin responder")).toBeTruthy();
    // Two windows tie: two yes and one if-need-be each.
    expect(screen.getByText("Van empatadas")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "24 – 28 mar · 25 – 29 mar" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Recordar a quien falta" }));
    const dialog = () => within(document.querySelector("dialog[open]") as HTMLElement);
    expect((dialog().getByRole("textbox") as HTMLTextAreaElement).value).toMatch(/^Faltan Eyman, Laura y Diego por decir/);
    await user.click(dialog().getByRole("button", { name: "Cerrar" }));

    await user.click(within(table).getByRole("button", { name: "Elegir 25 – 29 mar" }));
    expect(dialog().getByText(/El viaje pasa a estas fechas/)).toBeTruthy();
    await user.click(dialog().getByRole("button", { name: "Elegir estas fechas" }));
    expect(await screen.findByText("Fechas elegidas")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "25 – 29 mar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Elegir / })).toBeNull();
    expect(screen.getByRole("button", { name: "Anunciar las fechas" })).toBeTruthy();

    // Another trip without a date vote: propose two windows.
    await user.click(screen.getAllByRole("link", { name: "Viajes" })[0]!);
    await user.click(within(await screen.findByRole("article", { name: "Noviembre 2026" })).getByRole("button", { name: "Fechas" }));
    expect(await screen.findByRole("heading", { name: "Elige unas fechas" })).toBeTruthy();
    // Fixing them without a vote is offered too; this trip votes.
    expect(screen.getByRole("heading", { name: "¿Ya sabéis las fechas?" })).toBeTruthy();
    const voting = within(screen.getByRole("region", { name: "Votación de fechas" }));
    const propose = voting.getByRole("button", { name: "Proponer fechas" }) as HTMLButtonElement;
    expect(propose.disabled).toBe(true);
    const pick = async (from: string, to: string) => {
      await user.click(voting.getByRole("button", { name: from }));
      await user.click(voting.getByRole("button", { name: to }));
      await user.click(voting.getByRole("button", { name: "Añadir estas fechas" }));
    };
    await user.click(voting.getByRole("button", { name: "Mes siguiente" }));
    await user.click(voting.getByRole("button", { name: "Mes siguiente" }));
    await pick("2026-11-12", "2026-11-16");
    await pick("2026-11-03", "2026-11-07");
    await user.click(voting.getByRole("button", { name: "2026-11-03" }));
    await user.click(voting.getByRole("button", { name: "2026-11-07" }));
    expect(screen.getByRole("button", { name: "Ya está entre las opciones" })).toBeTruthy();
    const options = within(screen.getByRole("list", { name: "Opciones" })).getAllByRole("listitem");
    expect(options.map((o) => o.textContent)).toEqual([expect.stringMatching(/^3 – 7 nov/), expect.stringMatching(/^12 – 16 nov/)]);
    await user.click(screen.getByRole("button", { name: "Proponer fechas" }));
    expect(await screen.findByText("Fechas propuestas")).toBeTruthy();
    expect((dialog().getByRole("textbox") as HTMLTextAreaElement).value).toContain("Decid qué fechas os vienen bien: 3 – 7 nov o 12 – 16 nov.");
    await user.click(dialog().getByRole("button", { name: "Cerrar" }));
    expect(await screen.findByRole("table", { name: "Quién puede cuándo" })).toBeTruthy();
    expect(screen.getByText("Todavía no ha respondido nadie")).toBeTruthy();
  });
});

describe("El viaje", () => {
  it("waits for a decided destination, then prepares, edits and publishes the trip page", async () => {
    const user = userEvent.setup();
    const backend = mockBackend({ tickMs: 2, verifyMs: 2 });
    const view = render(
      <MemoryRouter initialEntries={["/viaje"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Todavía no hay destino decidido")).toBeTruthy();
    view.unmount();

    // Nápoles wins.
    const plan = (await backend.plan("noviembre-2026"))!.plan;
    await backend.savePlan({ ...plan, status: "closed", winnerDestinationId: "nap" });
    render(
      <MemoryRouter initialEntries={["/viaje"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const checklist = await screen.findByLabelText("Antes de publicar");
    expect(within(checklist).getByText("Destino decidido: Nápoles")).toBeTruthy();
    // Nápoles's prices came from the flight API a day ago: still good.
    expect(within(checklist).getByText("Precios comprobados con la API de vuelos")).toBeTruthy();
    // Nothing to publish before there's a guide.
    expect(screen.queryByRole("button", { name: "Publicar el viaje" })).toBeNull();

    // Where they leave from, and prepare: in place, no dialog.
    const home = within(checklist).getByLabelText("Salís desde") as HTMLInputElement;
    await user.clear(home);
    await user.type(home, "Logroño");
    await user.click(within(checklist).getByRole("button", { name: "Preparar con Claude" }));
    expect(await within(checklist).findByText("Claude está preparando la guía")).toBeTruthy();
    expect(screen.getByRole("status", { name: /En marcha: Claude prepara la guía de Nápoles/ })).toBeTruthy();
    expect(await screen.findByText("La guía de Nápoles está lista")).toBeTruthy();

    // Research's draft, editable.
    const todo = await screen.findByRole("list", { name: "Qué hacer" });
    expect((within(todo).getByLabelText("Qué hacer 1: título") as HTMLInputElement).value).toBe("Pompeya");
    expect((within(todo).getByLabelText("Qué hacer 1: € por persona") as HTMLInputElement).value).toBe("22");
    expect((screen.getByLabelText("Salís desde") as HTMLInputElement).value).toBe("Logroño");
    await user.click(within(todo).getByRole("button", { name: "Quitar Perderse por Spaccanapoli" }));
    await user.type(screen.getByLabelText("Dirección"), "Via Chiaia 12");
    await user.type(screen.getByLabelText("Enlace del Tricount (opcional)"), "https://tricount.com/xyz");
    // A row added and left empty doesn't go anywhere.
    await user.click(within(screen.getByRole("region", { name: "Sitios que ver" })).getByRole("button", { name: "Añadir" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("Cambios guardados")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Qué hacer" })).getAllByRole("listitem")).toHaveLength(3);
    expect(within(screen.getByRole("list", { name: "Sitios que ver" })).getAllByRole("listitem")).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Publicar el viaje" })[0]!);
    expect(await screen.findByText("Página del viaje publicada")).toBeTruthy();
    expect(screen.getByText("Publicada en el sitio")).toBeTruthy();
    const saved = await backend.trip("noviembre-2026");
    expect(saved).toMatchObject({ published: true, trip: { home: "Logroño", tricountUrl: "https://tricount.com/xyz", stay: { address: "Via Chiaia 12" } } });
    expect(screen.getByRole("button", { name: "Retirar del sitio" })).toBeTruthy();
  });
});

describe("Generar", () => {
  it("starts from the plan and streams a new search in", async () => {
    const user = userEvent.setup();
    // Slow enough to see the search while it runs.
    renderAt("/generar", 40);
    await screen.findByRole("heading", { name: "Nueva búsqueda" });
    expect(screen.getAllByRole("article")).toHaveLength(12);
    await user.click(screen.getByRole("button", { name: "Buscar 12 más" }));
    const progress = await screen.findByRole("region", { name: "Búsqueda en curso" });
    expect(within(progress).getByRole("button", { name: "Detener" })).toBeTruthy();
    expect((await within(progress).findAllByText(/^Buscando «/)).length).toBeGreaterThan(0);
    expect(await screen.findByText("Búsqueda terminada", undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Búsqueda en curso" })).toBeNull();
    expect(screen.getByText("12 propuestas nuevas")).toBeTruthy();
    // Approved ones keep their decision across a new search.
    expect(screen.getAllByRole("article")).toHaveLength(12);
  });

  it("researches one specific destination once", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    await screen.findByRole("heading", { name: "Nueva búsqueda" });
    await user.click(screen.getByRole("button", { name: "Destino" }));
    await user.click(screen.getByRole("option", { name: "Destino concreto…" }));
    expect((screen.getByRole("button", { name: "Investigar ese destino" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("¿Adónde?"), "Tallin");
    await user.click(screen.getByRole("button", { name: "Investigar Tallin" }));
    expect(await screen.findByText("Búsqueda terminada", undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText("1 propuesta nueva")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(13);
    expect(screen.getByRole("article", { name: "Tallin" })).toBeTruthy();
  });

  it("researches a friend's idea and credits them", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    const ideas = await screen.findByRole("region", { name: "Ideas del grupo" });
    expect(within(ideas).getByText("2 por investigar")).toBeTruthy();
    const azores = within(ideas).getByRole("listitem", { name: "Azores" });
    expect(within(azores).getByText(/idea de Iván/)).toBeTruthy();

    await user.click(within(within(ideas).getByRole("listitem", { name: "Oporto" })).getByRole("button", { name: "Descartar" }));
    expect(await within(ideas).findByText("1 por investigar")).toBeTruthy();
    expect(within(ideas).queryByRole("listitem", { name: "Oporto" })).toBeNull();

    await user.click(within(azores).getByRole("button", { name: "Investigar" }));
    expect(await within(azores).findByText("Investigada", undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.getAllByText("Idea de Iván").length).toBeGreaterThan(0);
  });

  it("picks the stay with two clicks on the calendar", async () => {
    const user = userEvent.setup();
    renderAt("/generar");
    await screen.findByRole("heading", { name: "Nueva búsqueda" });
    expect(screen.getAllByText(/7 – 14 nov · 7 noches/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "2026-11-20" }));
    expect(screen.getByText("Ahora elige el día de vuelta")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Buscar/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "2026-11-30" }));
    expect(screen.getAllByText(/20 – 30 nov · 10 noches/).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: /^Buscar/ }) as HTMLButtonElement).disabled).toBe(false);
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

  it("clears what isn't approved, and knows when the site is behind", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const dialog = () => within(document.querySelector("dialog[open]") as HTMLElement);

    // Never published yet, with 4 approved.
    expect(await screen.findByText("Cambios sin publicar")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Publicar 4 aprobadas" }));
    expect(await screen.findByText("4 destinos publicados en el sitio")).toBeTruthy();
    expect(await screen.findByText("El sitio está al día")).toBeTruthy();

    // One click (and a confirmation) clears the other 8.
    await user.click(screen.getByRole("button", { name: "Borrar las no aprobadas · 8" }));
    expect(dialog().getByText(/Las 4 aprobadas se quedan/)).toBeTruthy();
    await user.click(dialog().getByRole("button", { name: "Borrar" }));
    expect(await screen.findByText("8 propuestas borradas. Quedan las aprobadas.")).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect((screen.getByRole("button", { name: "Borrar las no aprobadas" }) as HTMLButtonElement).disabled).toBe(true);

    // Un-approving them all: publishing now empties the trip on the site.
    for (const card of screen.getAllByRole("article")) await user.click(within(card).getByRole("button", { name: "Aprobada" }));
    expect(await screen.findByText("Cambios sin publicar")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Vaciar el sitio" }));
    await user.click(dialog().getByRole("button", { name: "Vaciar el sitio" }));
    expect(await screen.findByText("Noviembre 2026 ya no tiene destinos en el sitio")).toBeTruthy();
    expect(await screen.findByText("El sitio está al día")).toBeTruthy();
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

describe("Revisar · precios", () => {
  it("takes prices checked by hand and labels them so", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Cracovia" });
    expect(within(card).getByText("Lo escribió Claude")).toBeTruthy();
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));

    // As the airline and Airbnb show them: one person's flight; the whole stay
    // for 6 people, 7 nights.
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    const flights = dialog.getByLabelText("Vuelo, ida y vuelta · € por persona") as HTMLInputElement;
    const stay = dialog.getByLabelText("Alojamiento · € en total") as HTMLInputElement;
    expect(flights.value).toBe("144");
    expect(stay.value).toBe("924");
    await user.clear(flights);
    await user.type(flights, "abc");
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await dialog.findByText(/Escribe cada precio en euros/)).toBeTruthy();
    await user.clear(flights);
    await user.type(flights, "200");
    await user.clear(stay);
    await user.type(stay, "840,60");
    // Each person's share, worked out as it's typed.
    const share = within(dialog.getByLabelText("Por persona"));
    expect(share.getByText("200 €")).toBeTruthy();
    expect(share.getByText("140 €")).toBeTruthy();
    expect(share.getByText("340 €")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));

    expect(await screen.findByText("Cracovia: precios comprobados a mano")).toBeTruthy();
    const after = screen.getByRole("article", { name: "Cracovia" });
    expect(within(after).getByText("Comprobado a mano")).toBeTruthy();
    expect(within(after).getByText(/Comprobado a mano · /)).toBeTruthy();
    expect(within(after).getByRole("button", { name: "cambiar precios" })).toBeTruthy();
    expect(within(after).getByText(/^Vuelos: 200 € ida y vuelta por persona/)).toBeTruthy();
    expect(within(after).getByText(/^Alojamiento: 841 € las 7 noches \(140 €\/persona\)/)).toBeTruthy();
  });
});

describe("Revisar · capturas", () => {
  it("fills the prices from screenshots of the flight and the Airbnb, and keeps the times", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Cracovia" });
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    expect(dialog.getByText(/verá solo el precio, sin horarios/)).toBeTruthy();
    // Google Flights, for this route on the trip's dates.
    const search = dialog.getByRole("link", { name: /Buscar en Google Flights/ }).getAttribute("href")!;
    expect(new URL(search).searchParams.get("q")).toMatch(/^Flights from MAD to KRK on \d{4}-\d\d-\d\d through \d{4}-\d\d-\d\d$/);
    expect(within(card).getByRole("link", { name: "buscar en Google Flights" }).getAttribute("href")).toBe(search);

    const shot = new File(["png"], "vuelo.png", { type: "image/png" });
    await user.upload(dialog.getByLabelText("Leer captura del vuelo"), shot);
    expect(await dialog.findByText(/^Ida · 11:55 MAD → 14:05 KRK/)).toBeTruthy();
    expect((dialog.getByLabelText("Vuelo, ida y vuelta · € por persona") as HTMLInputElement).value).toBe("272");

    await user.upload(dialog.getByLabelText("Leer captura del alojamiento"), new File(["png"], "airbnb.png", { type: "image/png" }));
    expect(await dialog.findByDisplayValue("Apartamento con terraza en De Pijp")).toBeTruthy();
    expect((dialog.getByLabelText("Alojamiento · € en total") as HTMLInputElement).value).toBe("1512");

    // Something that isn't an image is refused here, before reaching Claude.
    // (A file picker told to show only images can still be talked into a PDF.)
    await userEvent.setup({ applyAccept: false }).upload(dialog.getByLabelText("Leer captura del vuelo"), new File(["%PDF"], "billete.pdf", { type: "application/pdf" }));
    expect(await dialog.findByText("Sube capturas en PNG, JPG, WebP o GIF")).toBeTruthy();

    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    const after = await screen.findByRole("article", { name: "Cracovia" });
    // The checked times show; the stay is theirs.
    expect(await within(after).findByText(/^Vuelos: 272 € ida y vuelta por persona · Directo · 2 h 10 m · KLM/)).toBeTruthy();
    expect(within(after).getByText(/Apartamento con terraza en De Pijp$/)).toBeTruthy();
  });

  it("reads a pasted screenshot into the section being worked in, or asks which one it is", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Cracovia" });
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));
    const dialogEl = document.querySelector("dialog[open]") as HTMLElement;
    const dialog = within(dialogEl);
    const form = dialogEl.querySelector("form") as HTMLFormElement;
    const image = (name: string) => ({ clipboardData: { files: [new File(["png"], name, { type: "image/png" })] } });

    // Nothing worked in yet: which part is it?
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.paste(form, image("vuelo.png"));
    const ask = await dialog.findByRole("group", { name: "¿De qué es la captura?" });
    await user.click(within(ask).getByRole("button", { name: "Del vuelo" }));
    expect(await dialog.findByText(/^Ida · 11:55 MAD → 14:05 KRK/)).toBeTruthy();
    expect(dialog.queryByRole("group", { name: "¿De qué es la captura?" })).toBeNull();

    // Pasting while in the stay goes straight there.
    await user.click(dialog.getByLabelText("Alojamiento · € en total"));
    fireEvent.paste(form, image("airbnb.png"));
    expect(await dialog.findByDisplayValue("Apartamento con terraza en De Pijp")).toBeTruthy();
    expect((dialog.getByLabelText("Alojamiento · € en total") as HTMLInputElement).value).toBe("1512");
  });

  it("hides research's times when only the price was checked", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Cracovia" });
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await within(screen.getByRole("article", { name: "Cracovia" })).findByText("Vuelos: 144 € ida y vuelta por persona · MAD ⇄ KRK")).toBeTruthy();
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
    await user.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Abrir con 3 destinos" }));
    const message = (await screen.findByLabelText("Mensaje para el grupo")) as HTMLTextAreaElement;
    expect(message.value).toContain("Abierta la votación de Noviembre 2026");
    expect(message.value).toContain("• Laura:");
    expect(await screen.findByText(/Votación abierta hasta el/)).toBeTruthy();
  });
});

describe("Votación", () => {
  it("follows the vote, nudges who's missing, closes early and announces", async () => {
    const user = userEvent.setup();
    renderAt("/votacion");
    expect(await screen.findByText("La votación aún no está abierta")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "Ir a Comparativa" }));
    await user.click(await screen.findByRole("button", { name: "Enviar las 4 a votación" }));
    await user.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Abrir con 4 destinos" }));
    await user.click(await within(document.querySelector("dialog[open]") as HTMLElement).findByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("link", { name: /Votación abierta/ }));

    expect(await screen.findByText("4 de 6")).toBeTruthy();
    // The organiser sees the running count and each ballot while it's open.
    const provisional = screen.getByRole("table", { name: "Recuento provisional" });
    const first = within(provisional).getAllByRole("row")[1]!;
    expect(within(first).getByText("Marrakech")).toBeTruthy();
    expect(within(first).getByText("8")).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "Marta" })).getByText(/1\. Nápoles · 2\. Lisboa · 3\. Marrakech/)).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "Laura" })).getByText("Pendiente")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("4");
    await user.click(screen.getByRole("button", { name: "Recordar a quien falta" }));
    const reminder = (await screen.findByLabelText("Mensaje para el grupo")) as HTMLTextAreaElement;
    expect(reminder.value).toContain("Laura, Diego");
    await user.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Cerrar" }));

    await user.click(screen.getByRole("button", { name: "Cerrar ya" }));
    await user.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Cerrar con 4 votos" }));
    expect(await screen.findByText("Votación cerrada")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Marrakech" })).toBeTruthy();
    expect(screen.getAllByText("No votó")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Anunciar el resultado" }));
    expect(((await screen.findByLabelText("Mensaje para el grupo")) as HTMLTextAreaElement).value).toContain("nos vamos a Marrakech");
    await user.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: "Cerrar" }));

    // The group talks it over and goes for another one: the count stays.
    await user.click(screen.getByRole("button", { name: "Ir a otro destino" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    expect((dialog.getByRole("button", { name: "Elige un destino" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(dialog.getByRole("radio", { name: /Lisboa/ }));
    await user.type(dialog.getByLabelText("Por qué (opcional)"), "Mejores vuelos");
    await user.click(dialog.getByRole("button", { name: "Ir a Lisboa" }));
    expect(await screen.findByText("Vais a")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lisboa" })).toBeTruthy();
    expect(screen.getByText("La votación la ganó Marrakech · «Mejores vuelos»")).toBeTruthy();
    // And back.
    await user.click(screen.getByRole("button", { name: "Volver a Marrakech" }));
    expect(await screen.findByRole("heading", { name: "Marrakech" })).toBeTruthy();
    expect(screen.queryByText("Vais a")).toBeNull();
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
  it("opens on this month, takes start and end days, and creates the plan", async () => {
    const user = userEvent.setup();
    renderAt("/planes/nuevo");
    await user.type(await screen.findByLabelText("Nombre"), "Puente de diciembre");
    // The mocks' today is 25 Sept 2026: the calendar starts there, past days off.
    expect(screen.getByText("Septiembre 2026")).toBeTruthy();
    expect((screen.getByRole("button", { name: "2026-09-20" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Mes anterior" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Crear el plan" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await user.click(screen.getByRole("button", { name: "2026-12-05" }));
    await user.click(screen.getByRole("button", { name: "2026-12-09" }));
    expect(screen.getByText(/5 – 9 dic · 4 noches/)).toBeTruthy();
    // Everyone's ticked; Diego isn't coming to this one.
    expect(screen.getByText("6 personas")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Diego" }));
    expect(screen.getByText("5 personas")).toBeTruthy();
    // No price limit for this one.
    await user.click(screen.getByRole("checkbox", { name: "Sin límite de precio" }));
    expect(screen.getByText("Sin límite")).toBeTruthy();
    expect((screen.getByLabelText("Tope por persona") as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Crear el plan" }));
    expect(await screen.findByText(/Todavía no hay propuestas para Puente de diciembre/)).toBeTruthy();
    // Generar carries it over, and the people come from who goes, not a counter.
    expect(screen.getByText("Sin límite")).toBeTruthy();
    expect(screen.getByText("en este viaje", { exact: false }).textContent).toBe("5 personas en este viaje");
    expect(screen.queryByRole("button", { name: "Añadir una persona" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "También aeropuertos cercanos" })).toBeTruthy();
    expect(screen.getAllByText(/4 noches · 5 personas/).length).toBeGreaterThan(0);

    // Personas shows who goes on it, and changes it.
    await user.click(screen.getAllByRole("link", { name: "Personas" })[0]!);
    const trip = await screen.findByRole("form", { name: "Quién va a Puente de diciembre" });
    expect((within(trip).getByRole("checkbox", { name: "Diego" }) as HTMLInputElement).checked).toBe(false);
    await user.click(within(trip).getByRole("checkbox", { name: "Diego" }));
    await user.click(within(trip).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Guardado: 6 personas van a Puente de diciembre")).toBeTruthy();
  });
});

describe("Ajustes", () => {
  it("picks the AI among the ones set up, and says where the others' keys go", async () => {
    const user = userEvent.setup();
    renderAt("/ajustes");
    const inUse = await screen.findByRole("radiogroup", { name: "IA en uso" });
    const radios = within(inUse).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).checked)).toEqual([true, false]);
    expect(within(inUse).getByText("OpenAI · gpt-5")).toBeTruthy();
    expect(screen.getByText(/Añade ANTHROPIC_API_KEY a .env/)).toBeTruthy();
    expect(screen.getByText(/Añade AI_BASE_URL, AI_API_KEY y AI_MODEL/)).toBeTruthy();

    await user.click(within(inUse).getByLabelText(/OpenAI/));
    expect(await screen.findByText("Ahora usa OpenAI")).toBeTruthy();
    // The status dot and Generar follow the choice.
    expect(await screen.findByText("OpenAI", { selector: "span" })).toBeTruthy();
  });
});

describe("Añadir a mano", () => {
  it("adds a destination the organiser found, approved and checked by hand", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await screen.findByRole("article", { name: "Cracovia" });
    await user.click(screen.getByRole("button", { name: "Añadir a mano" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    await user.type(dialog.getByLabelText("Ciudad"), "Sevilla");
    await user.type(dialog.getByLabelText("País"), "España");
    await user.type(dialog.getByLabelText("Aeropuerto de llegada"), "sv");
    await user.type(dialog.getByLabelText(/Vuelo, ida y vuelta/), "95");
    await user.click(dialog.getByRole("button", { name: "Añadir y aprobar" }));
    expect(await dialog.findByText(/código de 3 letras/)).toBeTruthy();

    await user.type(dialog.getByLabelText("Aeropuerto de llegada"), "q");
    await user.type(dialog.getByLabelText("Alojamiento (opcional)"), "Piso en Triana");
    await user.type(dialog.getByLabelText(/€ en total, las 7 noches/), "1050");
    await user.click(dialog.getByRole("button", { name: "Añadir y aprobar" }));
    expect(await screen.findByText("Sevilla añadido y aprobado")).toBeTruthy();
    const card = await screen.findByRole("article", { name: "Sevilla" });
    expect(within(card).getByText("Comprobado a mano")).toBeTruthy();
  });
});

describe("Buscar desde el móvil", () => {
  it("searches in the background with the site's AI, and shows what it found", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/generar"]}>
        <ToastProvider>
          <PanelProvider backend={mockBackend({ tickMs: 2, verifyMs: 2, hosted: true, hostedAi: true })} jobPollMs={20}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    // The form shows: OpenAI on the site can search in the background.
    await user.click(await screen.findByRole("button", { name: /^Buscar 12 más/ }));
    const card = await screen.findByRole("region", { name: "Búsqueda en segundo plano" });
    expect(within(card).getByText("OpenAI está buscando destinos")).toBeTruthy();
    expect(within(card).getByText(/puedes cerrar esta página/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscando…" })).toBeTruthy();

    // Checked on until it ends; then the new proposals are in the trip.
    const done = await screen.findByRole("region", { name: "Búsqueda terminada" }, { timeout: 2000 });
    expect(within(done).getByText("3 propuestas nuevas")).toBeTruthy();
    await user.click(within(done).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("region", { name: "Búsqueda terminada" })).toBeNull();
  });
});

describe("Mirar en Google Flights / Airbnb", () => {
  it("reads the real pages for a finalist, and saves where the price was seen", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await screen.findByRole("button", { name: /^Publicar/ });
    await user.click(screen.getByRole("button", { name: /^Aprobadas/ }));
    const card = screen.getAllByRole("article")[0]!;
    const city = card.getAttribute("aria-label")!;
    await user.click(within(card).getByRole("button", { name: "ponerlos a mano" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);

    await user.click(dialog.getByRole("button", { name: "Mirar en Google Flights" }));
    await dialog.findByText(/^Ida · /);
    // Five flights to pick from; the first is filled in.
    const flights = dialog.getByRole("radiogroup", { name: "Vuelos encontrados" });
    expect(within(flights).getAllByRole("radio")).toHaveLength(5);
    await user.click(within(flights).getByRole("radio", { name: /El más barato/ }));
    expect(dialog.getByText(/^Ida · .* Vueling VY 811/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Mirar en Airbnb" }));
    // No stay chosen yet: the search's typical price, and three to pick.
    expect(await dialog.findByText(/^Mediana de 18 anuncios/)).toBeTruthy();
    await user.click(dialog.getByRole("radio", { name: /De Pijp/ }));
    await dialog.findByDisplayValue("https://www.airbnb.es/rooms/12345");
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await screen.findByText(`${city}: precios comprobados a mano`)).toBeTruthy();
    expect(within(screen.getByRole("article", { name: city })).getByText("Visto en Google Flights y Airbnb")).toBeTruthy();
  });

  it("checks both in one go from the card, and the organiser picks", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    await screen.findByRole("button", { name: /^Publicar/ });
    await user.click(screen.getByRole("button", { name: /^Aprobadas/ }));
    const card = screen.getAllByRole("article").find((a) => within(a).queryByRole("button", { name: "comprobar precios" }))!;
    const city = card.getAttribute("aria-label")!;
    await user.click(within(card).getByRole("button", { name: "comprobar precios" }));
    // Both read: the prices open to pick a flight and a stay.
    const dialog = within(await waitForDialog(3000));
    await user.click(await dialog.findByRole("radio", { name: /Directo, por la tarde/ }));
    await user.click(dialog.getByRole("radio", { name: /^Precio típico por ahora/ }));
    expect(dialog.getByDisplayValue("Por elegir en Airbnb")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await screen.findByText(`${city}: precios comprobados a mano`)).toBeTruthy();
    expect(within(screen.getByRole("article", { name: city })).getByText("Visto en Google Flights y Airbnb")).toBeTruthy();
  });

  it("isn't offered for a proposal not approved", async () => {
    const user = userEvent.setup();
    renderAt("/revisar");
    const card = await screen.findByRole("article", { name: "Cracovia" });
    await user.click(within(card).getByRole("button", { name: "poner precios reales" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    expect(dialog.queryByRole("button", { name: "Mirar en Google Flights" })).toBeNull();
    expect(dialog.getByRole("button", { name: "Leer captura del vuelo" })).toBeTruthy();
  });
});

describe("Cuándo", () => {
  it("fixes the dates without a vote, and ticks the step", async () => {
    const user = userEvent.setup();
    renderAt("/fechas");
    const step = await screen.findByRole("link", { name: /Cuándo/ });
    expect(step.textContent).toMatch(/^1/);
    const card = screen.getByRole("heading", { name: "¿Ya sabéis las fechas?" }).closest("div")!.parentElement!;
    await user.click(within(card).getByRole("button", { name: "Fijar estas fechas" }));
    expect(await screen.findByText("Fechas decididas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Cuándo/ }).textContent).not.toMatch(/^1/);
    // Settled: the vote is out of the way, and it can be undone.
    expect(screen.queryByRole("region", { name: "Votación de fechas" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Volver a decidirlas" }));
    expect(await screen.findByRole("heading", { name: "¿Ya sabéis las fechas?" })).toBeTruthy();
  });
});

describe("Días libres", () => {
  it("asks about days off once the dates are fixed, and lets the organiser mark them", async () => {
    const user = userEvent.setup();
    renderAt("/fechas");
    const card = (await screen.findByRole("heading", { name: "¿Ya sabéis las fechas?" })).closest("div")!.parentElement!;
    expect(screen.queryByRole("region", { name: /^Días libres/ })).toBeNull();
    await user.click(within(card).getByRole("button", { name: "Fijar estas fechas" }));

    const leave = await screen.findByRole("region", { name: /^Días libres/ });
    expect(within(leave).getByText(/^0 de \d+ aprobados$/)).toBeTruthy();
    const people = within(leave).getAllByRole("listitem");
    const first = people[0]!;
    const name = first.querySelector("span.font-semibold")!.textContent!;
    await user.click(within(first).getByRole("button", { name: `Días libres de ${name}` }));
    await user.click(within(first).getByRole("option", { name: "Días aprobados" }));
    expect(await within(leave).findByText(/^1 de \d+ aprobados$/)).toBeTruthy();
    expect(within(first).getByText("Marcado por ti")).toBeTruthy();

    await user.click(within(leave).getByRole("button", { name: "Recordar a quien falta" }));
    const message = (await screen.findByRole("textbox", { name: "Mensaje para el grupo" })) as HTMLTextAreaElement;
    expect(message.value).toMatch(/antes de reservar nada, ¿os han aprobado los días en el trabajo\?/);
    expect(message.value).not.toContain(name);
  });
});

describe("Moving around while the AI works", () => {
  // The trip being worked on is Noviembre, whatever another test left.
  beforeEach(() => localStorage.setItem("wanderlot:panel-plan", "noviembre-2026"));

  it("keeps preparing the guide on another screen, and says when it's ready", async () => {
    const user = userEvent.setup();
    const backend = mockBackend({ tickMs: 120, verifyMs: 2 });
    const plan = (await backend.plan("noviembre-2026"))!.plan;
    await backend.savePlan({ ...plan, status: "closed", winnerDestinationId: "nap" });
    render(
      <MemoryRouter initialEntries={["/viaje"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const checklist = await screen.findByLabelText("Antes de publicar");
    await user.click(within(checklist).getByRole("button", { name: "Preparar con Claude" }));
    expect(await within(checklist).findByText("Claude está preparando la guía")).toBeTruthy();

    // Off to Personas: the work goes on, shown in the top bar.
    await user.click(screen.getAllByRole("link", { name: "Personas" })[0]!);
    expect(await screen.findByRole("heading", { level: 1, name: "Personas" })).toBeTruthy();
    expect(screen.getByRole("status", { name: /En marcha: Claude prepara la guía de Nápoles/ })).toBeTruthy();
    const done = await screen.findByText("La guía de Nápoles está lista", {}, { timeout: 3000 });
    await user.click(within(done.parentElement!).getByRole("link", { name: "Ver" }));
    const back = await screen.findByLabelText("Antes de publicar");
    expect(within(back).getByText(/^Guía preparada el/)).toBeTruthy();
    expect(screen.queryByRole("status", { name: /En marcha/ })).toBeNull();
  });

  it("checks the prices from El viaje in one go, to pick and save", async () => {
    const user = userEvent.setup();
    const backend = mockBackend({ tickMs: 150, verifyMs: 2 });
    const plan = (await backend.plan("noviembre-2026"))!.plan;
    // Edimburgo won, and its prices are research's: not checked yet.
    await backend.review("noviembre-2026", "edi", "approved");
    await backend.savePlan({ ...plan, status: "closed", winnerDestinationId: "edi" });
    render(
      <MemoryRouter initialEntries={["/viaje"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const checklist = await screen.findByLabelText("Antes de publicar");
    await user.click(within(checklist).getByRole("button", { name: "Comprobar precios" }));
    expect(await within(checklist).findByText(/está mirando Google Flights en una ventana de Chrome \(1 de 2\)/)).toBeTruthy();
    const dialog = within(await waitForDialog(3000));
    await user.click(await dialog.findByRole("radio", { name: /De Pijp/ }));
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await within(checklist).findByText("Precios comprobados · Visto en Google Flights y Airbnb")).toBeTruthy();
  });
});

describe("El viaje once published", () => {
  beforeEach(() => localStorage.setItem("wanderlot:panel-plan", "noviembre-2026"));

  it("says when the site is behind the panel, and publishes the changes", async () => {
    const user = userEvent.setup();
    const backend = mockBackend({ tickMs: 2, verifyMs: 2 });
    const plan = (await backend.plan("noviembre-2026"))!.plan;
    await backend.review("noviembre-2026", "edi", "approved");
    await backend.savePlan({ ...plan, status: "closed", winnerDestinationId: "edi" });
    await backend.prepareTrip("noviembre-2026", "", () => {});
    await backend.publishTrip("noviembre-2026", true);
    render(
      <MemoryRouter initialEntries={["/viaje"]}>
        <ToastProvider>
          <PanelProvider backend={backend}>
            <App />
          </PanelProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const checklist = await screen.findByLabelText("Antes de publicar");
    expect(await within(checklist).findByText("Publicada en el sitio")).toBeTruthy();

    // Prices checked after publishing: the group still sees the old ones.
    await user.click(within(checklist).getByRole("button", { name: "Comprobar precios" }));
    const dialog = within(await waitForDialog(3000));
    await user.click(await dialog.findByRole("radio", { name: /De Pijp/ }));
    await user.click(dialog.getByRole("button", { name: "Guardar como comprobados" }));
    expect(await within(checklist).findByText("Hay cambios sin publicar")).toBeTruthy();
    await user.click(within(checklist).getByRole("button", { name: "Publicar cambios" }));
    expect(await within(checklist).findByText("Publicada en el sitio")).toBeTruthy();
  });
});

async function waitForDialog(ms = 2000): Promise<HTMLElement> {
  for (let i = 0; i < ms / 20; i++) {
    const d = document.querySelector("dialog[open]");
    if (d) return d as HTMLElement;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("no dialog opened");
}
