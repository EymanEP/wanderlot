// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "@wanderlot/ui";
import { App } from "../src/App.tsx";
import { AuthProvider, mockAuthClient } from "../src/data/auth.tsx";
import { mockSource } from "../src/data/source.ts";
import { SourceProvider } from "../src/data/store.tsx";

afterEach(cleanup);

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
    expect(await screen.findByRole("heading", { name: "Entra con tu passkey" })).toBeTruthy();
    expect(screen.queryByText("Noviembre 2026")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Votación" })).toBeTruthy();
  });

  it("accepts an invite with a passkey", async () => {
    const user = userEvent.setup();
    renderAt("/i/demo", false, false);
    expect(await screen.findByRole("heading", { name: "¿Eres Eyman?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Crear mi passkey" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Noviembre 2026" })).toBeTruthy();
  });

  it("explains a used invite and offers signing in", async () => {
    renderAt("/i/usada", false, false);
    expect(await screen.findByRole("heading", { name: "Esta invitación ya se usó" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Entrar con mi passkey" })).toBeTruthy();
  });

  it("signs this device out from the account menu", async () => {
    const user = userEvent.setup();
    renderAt("/p/noviembre-2026");
    await user.click(await screen.findByRole("button", { name: "Tu cuenta" }));
    await user.click(screen.getByRole("button", { name: "Cerrar sesión en este dispositivo" }));
    expect(await screen.findByRole("heading", { name: "Entra con tu passkey" })).toBeTruthy();
  });
});
