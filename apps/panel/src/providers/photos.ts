// Photo search for the picker in Revisar (SPEC §6). Every result is a real
// photo from one of three sources, linked rather than copied, with the credit
// its licence asks for. Claude only suggests what to search for.
import { standardImageUrl, type Photo } from "@wanderlot/core";

export type PhotoSourceName = Photo["source"];

export interface PhotoSource {
  name: PhotoSourceName;
  search(query: string, count: number, signal?: AbortSignal): Promise<Photo[]>;
  // Called once when the organiser keeps a photo (Unsplash counts downloads).
  picked?(photo: Photo): Promise<void>;
}

export type Fetch = typeof fetch;

const USER_AGENT = "Wanderlot/0.1 (https://github.com/EymanEP/wanderlot)";

async function getJson(fetcher: Fetch, url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<any> {
  const res = await fetcher(url, { headers: { "user-agent": USER_AGENT, ...headers }, signal });
  if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`);
  return res.json();
}

// "<a href=…>Ana</a>" → "Ana".
const plain = (html: string | undefined) =>
  (html ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Licences that let a friends' site show the photo with a credit.
const REUSABLE = /^(cc0|public domain|pd|cc by(-sa)? [0-9.]+|cc by(-sa)?)/i;

// Wikimedia Commons: no key needed. Asks for a 1280px rendition, one of the
// widths Wikimedia lets other sites load (see standardImageUrl).
export function wikimedia(fetcher: Fetch = fetch): PhotoSource {
  return {
    name: "wikimedia",
    async search(query, count, signal) {
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        generator: "search",
        gsrsearch: `${query} filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: String(Math.min(count * 2, 40)),
        prop: "imageinfo",
        iiprop: "url|size|extmetadata",
        iiurlwidth: "1280",
        origin: "*",
      });
      const data = await getJson(fetcher, `https://commons.wikimedia.org/w/api.php?${params}`, {}, signal);
      const pages: any[] = data?.query?.pages ?? [];
      return pages
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .flatMap((page): Photo[] => {
          const info = page.imageinfo?.[0];
          const meta = info?.extmetadata ?? {};
          const license = plain(meta.LicenseShortName?.value);
          if (!info?.thumburl || !REUSABLE.test(license)) return [];
          return [
            {
              url: standardImageUrl(info.thumburl),
              width: info.thumbwidth,
              height: info.thumbheight,
              source: "wikimedia",
              author: plain(meta.Artist?.value) || "Wikimedia Commons",
              license,
              sourceUrl: info.descriptionurl,
              alt: plain(meta.ObjectName?.value) || String(page.title).replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
            },
          ];
        })
        .slice(0, count);
    },
  };
}

// Unsplash: hotlinked as their guidelines require, with the photographer
// credited and a download counted when a photo is kept.
export function unsplash(accessKey: string, fetcher: Fetch = fetch): PhotoSource {
  const auth = { authorization: `Client-ID ${accessKey}`, "accept-version": "v1" };
  const utm = "utm_source=wanderlot&utm_medium=referral";
  return {
    name: "unsplash",
    async search(query, count, signal) {
      const params = new URLSearchParams({ query, per_page: String(Math.min(count, 30)), orientation: "landscape", content_filter: "high" });
      const data = await getJson(fetcher, `https://api.unsplash.com/search/photos?${params}`, auth, signal);
      return (data?.results ?? []).map(
        (p: any): Photo => ({
          url: p.urls.regular,
          width: p.width,
          height: p.height,
          source: "unsplash",
          author: p.user?.name || p.user?.username || "Unsplash",
          authorUrl: p.user?.links?.html ? `${p.user.links.html}?${utm}` : undefined,
          license: "Unsplash License",
          sourceUrl: `${p.links.html}?${utm}`,
          alt: p.alt_description || p.description || query,
          downloadLocation: p.links.download_location,
        }),
      );
    },
    async picked(photo) {
      // The URL arrives with the organiser's edit; the key goes to Unsplash only.
      if (!photo.downloadLocation) return;
      const url = new URL(photo.downloadLocation);
      if (url.protocol !== "https:" || url.hostname !== "api.unsplash.com" || url.port !== "") throw new Error("not an Unsplash download URL");
      await getJson(fetcher, url.href, auth);
    },
  };
}

export function pexels(apiKey: string, fetcher: Fetch = fetch): PhotoSource {
  return {
    name: "pexels",
    async search(query, count, signal) {
      const params = new URLSearchParams({ query, per_page: String(Math.min(count, 40)), orientation: "landscape" });
      const data = await getJson(fetcher, `https://api.pexels.com/v1/search?${params}`, { authorization: apiKey }, signal);
      return (data?.photos ?? []).map(
        (p: any): Photo => ({
          url: p.src.large2x ?? p.src.large,
          width: p.width,
          height: p.height,
          source: "pexels",
          author: p.photographer || "Pexels",
          authorUrl: p.photographer_url || undefined,
          license: "Pexels License",
          sourceUrl: p.url,
          alt: p.alt || query,
        }),
      );
    },
  };
}

// Searches every configured source at once and interleaves the results, so
// no single source crowds out the rest. A failing source is reported, not fatal.
export async function searchAll(
  sources: PhotoSource[],
  query: string,
  count: number,
  signal?: AbortSignal,
): Promise<{ photos: Photo[]; errors: { source: PhotoSourceName; message: string }[] }> {
  const settled = await Promise.allSettled(sources.map((s) => s.search(query, count, signal)));
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  const errors = settled.flatMap((r, i) => (r.status === "rejected" ? [{ source: sources[i]!.name, message: (r.reason as Error).message }] : []));
  const photos: Photo[] = [];
  for (let i = 0; photos.length < count && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (l[i] && photos.length < count) photos.push(l[i]!);
  }
  return { photos, errors };
}
