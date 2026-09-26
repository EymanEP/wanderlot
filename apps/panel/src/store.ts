// Panel storage: one JSON file on the organiser's machine. Proposals, drafts
// and editorial notes never leave it except through publish (SPEC §2).
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Destination, Plan, Proposal } from "@wanderlot/core";

// What Comparativa adds on top of an approved proposal, plus what to search
// for in the photo picker (never published).
export type Editorial = Pick<Destination, "pros" | "cons" | "weather" | "photos" | "inVote"> & { photoQueries: string[] };

export interface PlanEntry {
  plan: Plan;
  proposals: Proposal[];
  editorial: Record<string, Partial<Editorial>>;
}

// The latest invite link per member, kept here so the organiser can copy it
// again while it's unused; the site stores only its hash (SPEC §5).
export interface PendingInvite {
  token: string;
  expiresAt: string;
}

export interface PanelState {
  plans: Record<string, PlanEntry>;
  invites: Record<string, PendingInvite>;
}

export class PanelStore {
  private state: PanelState;

  constructor(private path: string | null) {
    this.state = { plans: {}, invites: {} };
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

  invite(memberId: string): PendingInvite | undefined {
    return this.state.invites[memberId];
  }

  setInvite(memberId: string, invite: PendingInvite | null) {
    if (invite) this.state.invites[memberId] = invite;
    else delete this.state.invites[memberId];
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
