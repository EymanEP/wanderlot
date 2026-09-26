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
