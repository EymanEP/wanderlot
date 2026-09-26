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

  it("takes a 6-digit PIN from before once, then asks for a new 4-digit one", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026/votacion", false, false);
    await user.type(await screen.findByLabelText("Tu nombre"), "Eyman");
    const pin = screen.getByLabelText("PIN") as HTMLInputElement;
    await user.type(pin, "480152");
    expect(pin.value).toBe("4801");
    await user.click(screen.getByRole("button", { name: "Mi PIN tiene 6 números (lo elegí antes)" }));
    await user.type(screen.getByLabelText("PIN"), "480152");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Elige tu PIN nuevo" })).toBeTruthy();
    await user.type(screen.getByLabelText("PIN nuevo"), "7304");
    await user.type(screen.getByLabelText("Repítelo"), "7305");
    await user.click(screen.getByRole("button", { name: "Guardar PIN" }));
    expect(await screen.findByText("Los dos PIN no coinciden")).toBeTruthy();
    await user.clear(screen.getByLabelText("Repítelo"));
    await user.type(screen.getByLabelText("Repítelo"), "7304");
    await user.click(screen.getByRole("button", { name: "Guardar PIN" }));
    // Then on to where they were going.
    expect(await screen.findByRole("heading", { level: 1, name: "Votación" })).toBeTruthy();
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
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
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
