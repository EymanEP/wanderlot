import { describe, expect, it } from "vitest";
import { Photo } from "@wanderlot/core";
import { pexels, searchAll, unsplash, wikimedia, type Fetch, type PhotoSource } from "../src/providers/photos.ts";

// Answers from the recorded shapes of each API; remembers what was asked.
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as Fetch;
  return { fetcher, calls };
}

describe("wikimedia", () => {
  const page = (index: number, license: string, artist = '<a href="//commons.wikimedia.org/wiki/User:Ana">Ana Pérez</a>') => ({
    index,
    title: `File:Torre de Belém ${index}.jpg`,
    imageinfo: [
      {
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Torre_${index}.jpg/1600px-Torre_${index}.jpg`,
        thumbwidth: 1600,
        thumbheight: 1067,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Torre_${index}.jpg`,
        extmetadata: { Artist: { value: artist }, LicenseShortName: { value: license } },
      },
    ],
  });

  it("keeps reusable licences, credits the author in plain text, in search order", async () => {
    const { fetcher, calls } = fakeFetch({
      query: { pages: [page(2, "CC BY-SA 4.0"), page(1, "CC0"), page(3, "Fair use"), page(4, "Public domain", "")] },
    });
    const photos = await wikimedia(fetcher).search("Torre de Belém", 5);

    expect(calls[0]!.url).toContain("commons.wikimedia.org/w/api.php");
    expect(new URL(calls[0]!.url).searchParams.get("gsrsearch")).toBe("Torre de Belém filetype:bitmap");
    expect(calls[0]!.headers["user-agent"]).toMatch(/^Wanderlot/);
    expect(photos.map((p) => p.license)).toEqual(["CC0", "CC BY-SA 4.0", "Public domain"]);
    expect(photos[0]).toMatchObject({ source: "wikimedia", author: "Ana Pérez", width: 1600, alt: "Torre de Belém 1" });
    expect(photos[2]!.author).toBe("Wikimedia Commons");
    for (const p of photos) Photo.parse(p);
  });

  it("returns nothing for no matches", async () => {
    const { fetcher } = fakeFetch({ batchcomplete: true });
    expect(await wikimedia(fetcher).search("zzz", 5)).toEqual([]);
  });
});

describe("unsplash", () => {
  const result = {
    width: 4000,
    height: 2667,
    alt_description: "tram in Alfama",
    urls: { regular: "https://images.unsplash.com/photo-1?w=1080" },
    links: { html: "https://unsplash.com/photos/abc", download_location: "https://api.unsplash.com/photos/abc/download?ixid=1" },
    user: { name: "Rui Silva", links: { html: "https://unsplash.com/@rui" } },
  };

  it("hotlinks, credits with referral links, and counts a download when kept", async () => {
    const { fetcher, calls } = fakeFetch({ results: [result] });
    const source = unsplash("key-1", fetcher);
    const [photo] = await source.search("Alfama", 5);

    expect(calls[0]!.headers.authorization).toBe("Client-ID key-1");
    expect(photo).toMatchObject({
      url: "https://images.unsplash.com/photo-1?w=1080",
      author: "Rui Silva",
      authorUrl: "https://unsplash.com/@rui?utm_source=wanderlot&utm_medium=referral",
      license: "Unsplash License",
      downloadLocation: result.links.download_location,
    });
    Photo.parse(photo);

    await source.picked!(photo!);
    expect(calls[1]!.url).toBe(result.links.download_location);
    expect(calls[1]!.headers.authorization).toBe("Client-ID key-1");
  });

  it("reports an error status", async () => {
    const { fetcher } = fakeFetch({ errors: ["OAuth error"] }, 401);
    await expect(unsplash("bad", fetcher).search("x", 1)).rejects.toThrow(/401/);
  });
});

describe("pexels", () => {
  it("maps photographer credit and the large rendition", async () => {
    const { fetcher, calls } = fakeFetch({
      photos: [
        {
          width: 5000,
          height: 3333,
          url: "https://www.pexels.com/photo/lisboa-123/",
          photographer: "Marta Gómez",
          photographer_url: "https://www.pexels.com/@marta",
          alt: "",
          src: { large2x: "https://images.pexels.com/photos/123/a.jpeg?w=1880", large: "https://images.pexels.com/photos/123/a.jpeg?h=650" },
        },
      ],
    });
    const [photo] = await pexels("pk", fetcher).search("Lisboa", 3);
    expect(calls[0]!.headers.authorization).toBe("pk");
    expect(photo).toMatchObject({ source: "pexels", author: "Marta Gómez", alt: "Lisboa", license: "Pexels License" });
    Photo.parse(photo);
  });
});

describe("searchAll", () => {
  const stub = (name: Photo["source"], n: number): PhotoSource => ({
    name,
    search: async () =>
      Array.from({ length: n }, (_, i) => ({
        url: `https://${name}.test/${i}.jpg`,
        source: name,
        author: "x",
        license: "x",
        sourceUrl: `https://${name}.test/${i}`,
        alt: "",
      })),
  });

  it("interleaves sources and survives one failing", async () => {
    const broken: PhotoSource = { name: "pexels", search: async () => Promise.reject(new Error("caído")) };
    const { photos, errors } = await searchAll([stub("wikimedia", 3), stub("unsplash", 1), broken], "q", 4);
    expect(photos.map((p) => p.url)).toEqual([
      "https://wikimedia.test/0.jpg",
      "https://unsplash.test/0.jpg",
      "https://wikimedia.test/1.jpg",
      "https://wikimedia.test/2.jpg",
    ]);
    expect(errors).toEqual([{ source: "pexels", message: "caído" }]);
  });
});
