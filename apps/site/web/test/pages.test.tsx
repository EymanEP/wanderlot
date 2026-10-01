// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "../src/App.tsx";
import { AuthProvider, mockAuthClient } from "../src/data/auth.tsx";
import { mockSource } from "../src/data/source.ts";
import { SourceProvider } from "../src/data/store.tsx";

afterEach(cleanup);

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

function renderAt(path: string, closed = false, signedIn = true) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider client={mockAuthClient(signedIn)}>
          <SourceProvider source={mockSource({ closed })}>
            <App />
          </SourceProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("Plan", () => {
  it("shows my own pick positions and never the tally", async () => {
    renderAt("/p/noviembre-2026");
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
    expect(screen.getByText("Tu 1.ª opción")).toBeTruthy();
    expect(screen.getByText("Sin tus puntos")).toBeTruthy();
    expect(screen.queryByText(/^\d+ puntos$/)).toBeNull();
    expect(screen.getByText("4 de 6 habéis votado")).toBeTruthy();
  });

  it("filters by category", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    await user.click(await screen.findByRole("button", { name: "Escapada" }));
    const cards = within(screen.getByRole("region", { name: "Destinos" })).getAllByRole("article");
    expect(cards.map((c) => c.querySelector("h2")!.textContent)).toEqual(["Marrakech"]);
  });
});

describe("Días libres", () => {
  it("lets me say I've got the days off, and shows where everyone is", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    const card = await screen.findByRole("region", { name: /^Días libres/ });
    expect(within(card).getByText("3 de 6 con los días")).toBeTruthy();
    const people = within(card).getByRole("list", { name: "Cómo va cada uno" });
    expect(within(people).getAllByRole("listitem")[0]!.textContent).toMatch(/Eyman \(tú\).*Aún no los ha pedido/);
    expect(within(card).queryByText(/Lo marcó/)).toBeNull();

    await user.click(within(card).getByRole("button", { name: "Me los han aprobado" }));
    expect(await within(card).findByText("4 de 6 con los días")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Me los han aprobado" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(people).getAllByRole("listitem")[0]!.textContent).toMatch(/Días aprobados/);
  });
});

describe("Proponer un destino", () => {
  it("sends an idea to the organiser and shows what's been suggested", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    await user.click(await screen.findByRole("button", { name: "Proponer un destino" }));
    const dialog = within(document.querySelector("dialog[open]") as HTMLElement);
    expect(await dialog.findByText("Oporto")).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Enviar idea" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(dialog.getByLabelText("Destino"), "Azores");
    await user.type(dialog.getByLabelText("Por qué (opcional)"), "Naturaleza a lo bestia");
    await user.click(dialog.getByRole("button", { name: "Enviar idea" }));
    expect(await screen.findByText("Idea enviada. Eyman la verá en el panel.")).toBeTruthy();
  });

  it("isn't offered once the vote has closed", async () => {
    renderAt("/p/noviembre-2026", true);
    await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" });
    expect(screen.queryByRole("button", { name: "Proponer un destino" })).toBeNull();
  });
});

describe("Votación", () => {
  it("keeps the scoreboard hidden while voting and lets me change my ballot", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/votacion");
    expect(await screen.findByText("Marcador cerrado")).toBeTruthy();
    expect(screen.getAllByLabelText("puntos ocultos")).toHaveLength(4);

    const save = screen.getByRole("button", { name: "Guardar mi reparto" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    // Nápoles comes in and replaces my third pick, Budapest.
    await user.click(screen.getByRole("button", { name: "Darle 1 punto" }));
    const ballot = () => within(screen.getByRole("list", { name: "Tu reparto" })).getAllByRole("listitem").map((li) => li.textContent!.split(",")[0]!.replace(/^\d+PUNTOS?/, ""));
    expect(ballot()).toEqual(["Marrakech", "Lisboa", "Nápoles"]);

    // Move Nápoles to first.
    await user.click(screen.getByRole("button", { name: "Subir Nápoles a la segunda posición" }));
    await user.click(screen.getByRole("button", { name: "Subir Nápoles a la primera posición" }));
    expect(ballot()).toEqual(["Nápoles", "Marrakech", "Lisboa"]);
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(await screen.findByText("Reparto guardado")).toBeTruthy();
  });

  it("needs three picks before saving", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/votacion");
    await user.click((await screen.findAllByRole("button", { name: "Quitar" }))[2]!);
    expect((screen.getByRole("button", { name: "Guardar mi reparto" }) as HTMLButtonElement).disabled).toBe(true);
    // With a free slot the newcomer gets the points of that slot.
    expect(screen.getAllByRole("button", { name: "Darle 1 punto" })).toHaveLength(2);
  });

  it("shows the full count and the winner once closed", async () => {
    renderAt("/p/noviembre-2026/votacion", true);
    expect(await screen.findByRole("heading", { level: 1, name: "Votación cerrada" })).toBeTruthy();
    expect(screen.getByText("12 pts")).toBeTruthy();
    expect(screen.getByText("Cómo votó cada uno")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
  });
});

describe("Fechas", () => {
  it("lists the trip first on Tus viajes and takes answers for every window", async () => {
    const user = userEvent.setup();
    renderAt("/");
    const trip = await screen.findByRole("article", { name: "Semana Santa 2027" });
    expect(within(trip).getByText("Te falta decir fechas")).toBeTruthy();
    expect(within(trip).getByText(/^Fechas por decidir/)).toBeTruthy();
    await user.click(trip);

    expect(await screen.findByRole("heading", { level: 1, name: "¿Cuándo nos vamos?" })).toBeTruthy();
    // Fechas leads the trip's sections while it's open.
    const nav = screen.getAllByRole("navigation", { name: "Secciones" })[0]!;
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["Fechas", "Destinos", "Votación", "Comentarios"]);
    expect(screen.getByText("3 de 6 respuestas")).toBeTruthy();

    // Who can go when, for everyone.
    const who = screen.getByRole("listitem", { name: "24 – 28 mar" });
    expect(within(who).getByText("2 sí · 1 si hace falta · 0 no")).toBeTruthy();
    expect(within(who).getByText("Las mejores")).toBeTruthy();
    expect(screen.getByText("«Tengo que pedirlo antes del 15»")).toBeTruthy();
    expect(screen.getByText("Faltan Eyman, Laura y Diego.")).toBeTruthy();

    const save = screen.getByRole("button", { name: "Responder" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.click(within(screen.getByRole("radiogroup", { name: "24 – 28 mar" })).getByLabelText("Sí"));
    await user.click(within(screen.getByRole("radiogroup", { name: "25 – 29 mar" })).getByLabelText("Si hace falta"));
    expect(save.disabled).toBe(true);
    await user.click(within(screen.getByRole("radiogroup", { name: "1 – 5 abr" })).getByLabelText("No"));
    await user.type(screen.getByLabelText("Algo que haya que saber (opcional)"), "Mejor antes de Pascua");
    await user.click(save);
    expect(await screen.findByText("Respuesta guardada")).toBeTruthy();
    expect(screen.getByText("4 de 6 respuestas")).toBeTruthy();
    expect(within(screen.getByRole("listitem", { name: "24 – 28 mar" })).getByText("3 sí · 1 si hace falta · 0 no")).toBeTruthy();
    expect(screen.getByText("Faltan Laura y Diego.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guardar mi respuesta" })).toBeTruthy();
  });

  it("isn't there for a trip without a date vote", async () => {
    renderAt("/p/noviembre-2026/fechas");
    expect(await screen.findByText("Este viaje no tiene votación de fechas")).toBeTruthy();
    const nav = screen.getAllByRole("navigation", { name: "Secciones" })[0]!;
    expect(within(nav).queryByRole("link", { name: "Fechas" })).toBeNull();
  });
});

describe("El viaje", () => {
  it("opens from Tus viajes once published, with the plan in one page", async () => {
    const user = userEvent.setup();
    renderAt("/", true);
    const trip = await screen.findByRole("article", { name: "Noviembre 2026" });
    expect(within(trip).getByText("El viaje está listo")).toBeTruthy();
    await user.click(trip);

    expect(await screen.findByRole("heading", { level: 1, name: "Nápoles" })).toBeTruthy();
    const nav = screen.getAllByRole("navigation", { name: "Secciones" })[0]!;
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["El viaje", "Destinos", "Votación", "Comentarios"]);

    // Each person's share, and the group's Tricount.
    const money = screen.getByLabelText("Lo que pone cada uno");
    expect(within(money).getByText(/^Vuelo \d+ € · alojamiento \d+ €$/)).toBeTruthy();
    expect(within(money).getByRole("link", { name: /Abrir el Tricount/ }).getAttribute("href")).toBe("https://tricount.com/es/grupo51-napoles");
    // The stay, with the details the organiser added.
    expect(screen.getByRole("link", { name: "Via Chiaia 12, Nápoles" }).getAttribute("href")).toContain("google.com/maps");
    // Cómo llegar, both ends.
    const toAirport = screen.getByRole("list", { name: "De Logroño al aeropuerto (MAD)" });
    expect(within(toAirport).getByText("Coche hasta Barajas")).toBeTruthy();
    expect(within(toAirport).getByText("≈ 34 €")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Del aeropuerto (NAP) al alojamiento" })).getByText("Alibus")).toBeTruthy();
    // The guide, labelled as Claude's, with approximate prices.
    expect(screen.getByRole("heading", { name: "Qué hacer" })).toBeTruthy();
    expect(screen.getByText("≈ 22 €")).toBeTruthy();
    expect(screen.getByText("Dónde: Pastelerías de Via Toledo")).toBeTruthy();
    expect(screen.getByText("Lo escribió Claude")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Antes de ir" })).toBeTruthy();

    // The destinations page points to it.
    await user.click(within(nav).getByRole("link", { name: "Destinos" }));
    expect(await screen.findByText("El viaje está listo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver el viaje" })).toBeTruthy();
  });

  it("isn't there before it's published", async () => {
    renderAt("/p/noviembre-2026/viaje");
    expect(await screen.findByText("La página del viaje aún no está lista")).toBeTruthy();
  });
});

describe("Destino", () => {
  it("adds a comment and a reply", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/destinos/nap");
    expect(await screen.findByRole("heading", { level: 1, name: "Nápoles" })).toBeTruthy();
    await user.type(screen.getByPlaceholderText("Escribe un comentario…"), "Yo me apunto a Pompeya");
    await user.click(screen.getByRole("button", { name: "Comentar" }));
    expect(screen.getByText("Yo me apunto a Pompeya")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Comentarios · 4" })).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Responder" })[0]!);
    await user.type(screen.getByPlaceholderText("Responder a Marta…"), "Madrugamos, prometido{Enter}");
    expect(screen.getByText("Madrugamos, prometido")).toBeTruthy();
  });

  it("sends unknown destinations back to the plan", async () => {
    renderAt("/p/noviembre-2026/destinos/xyz");
    expect(await screen.findByText("Este destino no está en el plan")).toBeTruthy();
  });
});

describe("Signing in", () => {
  it("sends a signed-out visitor to Entrar and back to where they were going", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/votacion", false, false);
    expect(await screen.findByRole("heading", { name: "Entra en Grupo 51" })).toBeTruthy();
    expect(screen.queryByText("Noviembre 2026")).toBeNull();
    // From a laptop: name and PIN, no passkey needed. A wrong PIN says so.
    await user.type(screen.getByLabelText("Tu nombre"), "Eyman");
    await user.type(screen.getByLabelText("PIN"), "1352");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Nombre o PIN incorrectos")).toBeTruthy();
    await user.type(screen.getByLabelText("PIN"), "4801");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Votación" })).toBeTruthy();
  });

  it("changes the PIN from the account menu, then goes back", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/votacion");
    await screen.findByRole("heading", { level: 1, name: "Votación" });
    await user.click(screen.getAllByRole("button", { name: "Tu cuenta" })[0]!);
    await user.click(screen.getByRole("button", { name: "Cambiar mi PIN" }));
    expect(await screen.findByRole("heading", { name: "Cambia tu PIN" })).toBeTruthy();
    await user.type(screen.getByLabelText("PIN nuevo"), "7304");
    await user.type(screen.getByLabelText("Repítelo"), "7305");
    await user.click(screen.getByRole("button", { name: "Guardar PIN" }));
    expect(await screen.findByText("Los dos PIN no coinciden")).toBeTruthy();
    await user.clear(screen.getByLabelText("Repítelo"));
    await user.type(screen.getByLabelText("Repítelo"), "7304");
    await user.click(screen.getByRole("button", { name: "Guardar PIN" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Votación" })).toBeTruthy();
  });

  it("takes only 4-digit PINs", async () => {
    const user = userEvent.setup();
    renderAt("/entrar", false, false);
    const pin = (await screen.findByLabelText("PIN")) as HTMLInputElement;
    await user.type(pin, "480152");
    expect(pin.value).toBe("4801");
    expect(screen.queryByText(/6 números/)).toBeNull();
  });

  it("accepts an invite by choosing a PIN", async () => {
    const user = userEvent.setup();
    renderAt("/i/demo", false, false);
    expect(await screen.findByRole("heading", { name: "¿Eres Eyman?" })).toBeTruthy();
    await user.type(screen.getByLabelText("Tu PIN"), "4801");
    await user.type(screen.getByLabelText("Repítelo"), "4802");
    await user.click(screen.getByRole("button", { name: "Guardar PIN y entrar" }));
    expect(await screen.findByText("Los dos PIN no coinciden")).toBeTruthy();
    await user.clear(screen.getByLabelText("Repítelo"));
    await user.type(screen.getByLabelText("Repítelo"), "4801");
    await user.click(screen.getByRole("button", { name: "Guardar PIN y entrar" }));
    // In: their trips, to pick one.
    expect(await screen.findByRole("heading", { level: 1, name: "Tus viajes" })).toBeTruthy();
    const trip = await screen.findByRole("article", { name: "Noviembre 2026" });
    expect(within(trip).getByText("Ya has votado")).toBeTruthy();
    await user.click(trip);
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
    // The logo leads back to them.
    await user.click(screen.getByRole("link", { name: "Tus viajes" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Tus viajes" })).toBeTruthy();
  });

  it("explains a used invite and offers signing in", async () => {
    renderAt("/i/usada", false, false);
    expect(await screen.findByRole("heading", { name: "Esta invitación ya se usó" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Entrar con mi nombre y PIN" })).toBeTruthy();
  });

  it("signs this device out from the account menu", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    await user.click(await screen.findByRole("button", { name: "Tu cuenta" }));
    await user.click(screen.getByRole("button", { name: "Cerrar sesión en este dispositivo" }));
    expect(await screen.findByRole("heading", { name: "Entra en Grupo 51" })).toBeTruthy();
  });
});

describe("Moving between pages", () => {
  // Newer Chrome's scrollTo returns a Promise; the site used to hand it to
  // React as an effect cleanup and went blank on the next page change.
  it("survives a scrollTo that returns a Promise", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((() => Promise.resolve()) as never);
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
    await user.click(screen.getAllByRole("link", { name: "Votación" })[0]!);
    expect(await screen.findByRole("heading", { level: 1, name: "Votación" })).toBeTruthy();
    await user.click(screen.getAllByRole("link", { name: "Comentarios" })[0]!);
    await user.click(screen.getAllByRole("link", { name: "Destinos" })[0]!);
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
    expect(screen.queryByText("Algo ha fallado al mostrar esta página")).toBeNull();
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
