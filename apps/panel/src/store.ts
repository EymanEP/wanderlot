// Panel storage: one JSON file on the organiser's machine. Proposals, drafts
// and editorial notes never leave it except through publish (SPEC §2).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Destination, Plan, Proposal } from "@wanderlot/core";

// What Comparativa adds on top of an approved proposal.
export type Editorial = Pick<Destination, "pros" | "cons" | "weather" | "photos" | "inVote">;

export interface PlanEntry {
  plan: Plan;
  proposals: Proposal[];
  editorial: Record<string, Partial<Editorial>>;
}

// Each member's private site link. Kept here so the organiser can reprint
// them; the site stores only their hashes (SPEC §5).
export interface MemberLink {
  id: string;
  name: string;
  token: string;
}

export interface PanelState {
  plans: Record<string, PlanEntry>;
  links: MemberLink[];
}

export class PanelStore {
  private state: PanelState;

  constructor(private path: string | null) {
    this.state = { plans: {}, links: [] };
    if (path) {
      try {
        this.state = { ...this.state, ...(JSON.parse(readFileSync(path, "utf8")) as Partial<PanelState>) };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
  }

  get(planId: string): PlanEntry | undefined {
    return this.state.plans[planId];
  }

  list(): Plan[] {
    return Object.values(this.state.plans).map((e) => e.plan);
  }

  update<T>(planId: string, fn: (entry: PlanEntry | undefined) => { entry: PlanEntry; result: T }): T {
    const { entry, result } = fn(this.state.plans[planId]);
    this.state.plans[planId] = entry;
    this.save();
    return result;
  }

  links(): MemberLink[] {
    return this.state.links;
  }

  setLinks(issued: MemberLink[]) {
    const byId = new Map(this.state.links.map((l) => [l.id, l]));
    for (const l of issued) byId.set(l.id, l);
    this.state.links = [...byId.values()];
    this.save();
  }

  private save() {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.path);
  }
}
