// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Photo } from "@wanderlot/core";
import { PhotoMosaic } from "../src/components/DestinationParts.tsx";

afterEach(cleanup);

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

const photo = (n: string): Photo => ({
  url: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${n}.jpg/1600px-${n}.jpg`,
  source: "wikimedia",
  author: `Autor ${n}`,
  license: "CC BY-SA 4.0",
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${n}.jpg`,
  alt: `Foto ${n}`,
});

describe("PhotoMosaic", () => {
  it("fills the grid, loads standard Wikimedia sizes and opens every photo", async () => {
    const user = userEvent.setup();
    render(<PhotoMosaic city="Lisboa" photos={["a", "b", "c", "d", "e"].map(photo)} landmarks={[]} />);
    const grid = screen.getByRole("region", { name: "Fotos" });
    // Hero plus four on a wide screen.
    const srcs = within(grid).getAllByRole("img").map((i) => (i as HTMLImageElement).src.split("/").pop());
    expect(srcs).toEqual(["1280px-a.jpg", "1280px-b.jpg", "1280px-c.jpg", "1280px-d.jpg", "1280px-e.jpg"]);

    await user.click(within(grid).getByRole("button", { name: "Ver las 5 fotos" }));
    const gallery = screen.getByRole("list", { name: "Fotos de Lisboa" });
    expect(within(gallery).getAllByRole("img")).toHaveLength(5);
    expect(within(gallery).getAllByRole("link", { name: "Autor e" })).toHaveLength(1);
  });

  it.each([1, 2, 3, 4])("lays out %i photos with no empty tile", (n) => {
    render(<PhotoMosaic city="Lisboa" photos={["a", "b", "c", "d"].slice(0, n).map(photo)} landmarks={["Belém", "Alfama", "Sintra", "Baixa"]} />);
    const grid = screen.getByRole("region", { name: "Fotos" });
    // Every tile is a photo: none is left to a landmark's name.
    expect(within(grid).getAllByRole("img")).toHaveLength(n);
    expect(grid.children).toHaveLength(n + 1);
    expect(within(grid).queryByText(/^\[/)).toBeNull();
    expect(within(grid).getByRole("button", { name: n === 1 ? "Ver la foto" : `Ver las ${n} fotos` })).toBeTruthy();
  });

  it("shows the landmarks until photos are picked, with no gallery button", () => {
    render(<PhotoMosaic city="Lisboa" photos={[]} landmarks={["Belém", "Alfama"]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("[Foto de Lisboa]")).toBeTruthy();
    expect(screen.getAllByText("[Belém]").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
