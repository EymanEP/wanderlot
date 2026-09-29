// Which AI does research, reads screenshots and drafts the guide (ROADMAP
// 3.3): the `claude` command, or an API key for Anthropic, OpenAI or any
// OpenAI-compatible endpoint. Keys come from the environment (.env on the
// laptop, Worker secrets on the site), never from the browser; the organiser
// picks among the ones set up in Ajustes.
import { OPENAI_URL, openaiProvider } from "./openai.ts";
import type { ResearchProvider } from "./types.ts";

export const AI_IDS = ["claude-cli", "anthropic-api", "openai-api", "compatible-api"] as const;
export type AiId = (typeof AI_IDS)[number];

// What the settings page shows for each.
export interface AiOption {
  id: AiId;
  name: string;
  // The model, when it's ours to say.
  model: string | null;
  ready: boolean;
  // How to set it up, when it isn't.
  setup: string;
  // Searches the web (otherwise prices are estimates), and reads images.
  search: boolean;
  images: boolean;
}

export interface AiView {
  options: AiOption[];
  active: AiId | null;
  // The site's panel can't change it: it uses the first one set up there.
  canChoose: boolean;
}

export interface AiEntry {
  option: AiOption;
  make: () => ResearchProvider;
}

export const OPENAI_MODEL = "gpt-5";

// Settings for the API providers; the `claude` command is found separately.
export interface AiEnv {
  ANTHROPIC_API_KEY?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  OPENAI_MODEL?: string | undefined;
  AI_BASE_URL?: string | undefined;
  AI_API_KEY?: string | undefined;
  AI_MODEL?: string | undefined;
  // As friends see it; the endpoint's host otherwise.
  AI_NAME?: string | undefined;
}

// The API providers, in order of preference. `anthropic` builds the
// Anthropic one (its SDK loads only where it's used).
export function apiEntries(env: AiEnv, anthropic: (key: string) => ResearchProvider, where: "local" | "site"): AiEntry[] {
  const secret = (name: string) => (where === "local" ? `Añade ${name} a .env (npm run setup) y reinicia el panel.` : `Guárdala en el sitio: npx wrangler secret put ${name} (en apps/site).`);
  const openaiModel = env.OPENAI_MODEL || OPENAI_MODEL;
  let host = "";
  try {
    host = env.AI_BASE_URL ? new URL(env.AI_BASE_URL).hostname.replace(/^(www|api)\./, "") : "";
  } catch {}
  const compatibleName = env.AI_NAME || host || "Otra IA";
  return [
    {
      option: { id: "anthropic-api", name: "Claude (API de Anthropic)", model: null, ready: !!env.ANTHROPIC_API_KEY, setup: secret("ANTHROPIC_API_KEY"), search: true, images: true },
      make: () => anthropic(env.ANTHROPIC_API_KEY!),
    },
    {
      option: { id: "openai-api", name: "OpenAI", model: openaiModel, ready: !!env.OPENAI_API_KEY, setup: secret("OPENAI_API_KEY"), search: true, images: true },
      make: () => openaiProvider({ apiKey: env.OPENAI_API_KEY!, model: openaiModel, baseUrl: OPENAI_URL, api: "responses", name: "OpenAI" }),
    },
    {
      option: {
        id: "compatible-api",
        name: env.AI_BASE_URL ? compatibleName : "Otra IA compatible con OpenAI",
        model: env.AI_MODEL || null,
        ready: !!(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL && host),
        setup:
          where === "local"
            ? "Añade AI_BASE_URL, AI_API_KEY y AI_MODEL a .env (OpenRouter, por ejemplo: https://openrouter.ai/api/v1) y reinicia el panel."
            : "Guarda AI_BASE_URL, AI_API_KEY y AI_MODEL en el sitio con npx wrangler secret put (en apps/site).",
        search: false,
        images: true,
      },
      make: () => openaiProvider({ apiKey: env.AI_API_KEY!, model: env.AI_MODEL!, baseUrl: env.AI_BASE_URL!.replace(/\/+$/, ""), api: "chat", name: compatibleName }),
    },
  ];
}

// The one in use: the chosen one if it's set up, else the first that is.
export class AiChoice {
  private chosen: AiId | null;
  private made = new Map<AiId, ResearchProvider>();

  constructor(
    readonly entries: AiEntry[],
    chosen: AiId | null = null,
    // Keeps the choice (the laptop's .env); absent where it can't change.
    private readonly save?: (id: AiId) => void,
  ) {
    this.chosen = chosen;
  }

  get active(): AiEntry | null {
    return this.entries.find((e) => e.option.id === this.chosen && e.option.ready) ?? this.entries.find((e) => e.option.ready) ?? null;
  }

  provider(): ResearchProvider | null {
    const entry = this.active;
    if (!entry) return null;
    const id = entry.option.id;
    if (!this.made.has(id)) this.made.set(id, entry.make());
    return this.made.get(id)!;
  }

  view(): AiView {
    return { options: this.entries.map((e) => e.option), active: this.active?.option.id ?? null, canChoose: !!this.save };
  }

  choose(id: AiId): void {
    const entry = this.entries.find((e) => e.option.id === id);
    if (!entry?.option.ready) throw new Error("Esa IA no está configurada");
    if (!this.save) throw new Error("Aquí no se puede cambiar");
    this.chosen = id;
    this.save(id);
  }
}
