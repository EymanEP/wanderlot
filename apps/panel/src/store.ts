// Panel storage (ROADMAP 3.2). The routes read and write a synchronous
// in-memory copy; underneath, a backend keeps it: the site's database (over
// the admin API from the laptop, or directly in the hosted panel), or a local
// JSON file for sites too old to hold it. Each request refreshes the copy
// first and waits for its writes at the end (see app.ts), so the laptop and
// the phone see each other's changes. Proposals, drafts and notes never reach
// friends except through publish (SPEC §2).
import type { Destination, Plan, Proposal, TripPage } from "@wanderlot/core";

// What Comparativa adds on top of an approved proposal, plus what to search
// for in the photo picker (never published).
export type Editorial = Pick<Destination, "pros" | "cons" | "weather" | "photos" | "inVote"> & { photoQueries: string[] };

export interface PlanEntry {
  plan: Plan;
  proposals: Proposal[];
  editorial: Record<string, Partial<Editorial>>;
  // Member ids on this trip: only they see it on the site (SPEC §5).
  participants?: string[];
  // The last publish: when, and a fingerprint of what went, to tell whether
  // the site is behind the panel.
  published?: { at: string; fingerprint: string };
  // El viaje (ROADMAP 2.2): the trip page being prepared, and whether it goes
  // to the site with the next publish.
  trip?: TripPage;
  tripPublished?: boolean;
}

// The latest invite link per member, kept so the organiser can copy it again
// while it's unused. The site checks invites by hash only (SPEC §5); where it
// keeps these for the panel, they're encrypted with the admin token.
export interface PendingInvite {
  token: string;
  expiresAt: string;
}

export interface PanelState {
  plans: Record<string, PlanEntry>;
  invites: Record<string, PendingInvite>;
}

// Where the panel's data lives. Versions guard against two devices saving
// the same trip at once: a save names the version it read.
export interface PanelBackend {
  versions(): Promise<Record<string, number>>;
  plan(planId: string): Promise<{ entry: PlanEntry; version: number } | null>;
  // null deletes. Resolves to the new version; rejects with StoreConflict
  // when someone else saved first.
  save(planId: string, entry: PlanEntry | null, version: number): Promise<number>;
  invites(): Promise<Record<string, PendingInvite>>;
  saveInvite(memberId: string, invite: PendingInvite | null): Promise<void>;
}

export class StoreConflict extends Error {
  constructor(readonly planId: string) {
    super("Este viaje ha cambiado desde otro dispositivo. Recarga la página y vuelve a probar.");
  }
}

// Everything in memory: tests, and a fresh panel with nothing to keep.
export function memoryBackend(initial: Partial<PanelState> = {}): PanelBackend {
  const plans = new Map(Object.entries(initial.plans ?? {}).map(([id, entry]) => [id, { entry, version: 1 }]));
  let invites = { ...(initial.invites ?? {}) };
  return {
    versions: async () => Object.fromEntries([...plans].map(([id, p]) => [id, p.version])),
    plan: async (id) => plans.get(id) ?? null,
    async save(id, entry, version) {
      const current = plans.get(id)?.version ?? 0;
      if (current !== version) throw new StoreConflict(id);
      if (!entry) {
        plans.delete(id);
        return 0;
      }
      plans.set(id, { entry: structuredClone(entry), version: current + 1 });
      return current + 1;
    },
    invites: async () => ({ ...invites }),
    async saveInvite(memberId, invite) {
      invites = { ...invites };
      if (invite) invites[memberId] = invite;
      else delete invites[memberId];
    },
  };
}

export class PanelStore {
  private plans: Record<string, PlanEntry> = {};
  private invitesById: Record<string, PendingInvite> = {};
  private versionOf: Record<string, number> = {};
  // Trips with a write not yet saved: a refresh keeps our copy of them.
  private unsaved = new Map<string, number>();
  private queue: Promise<void> = Promise.resolve();
  private failures: Error[] = [];
  private loaded = false;
  readonly backend: PanelBackend;

  constructor(backend: PanelBackend | null = null) {
    this.backend = backend ?? memoryBackend();
  }

  // Brings the copy up to date: only trips whose version changed are read.
  async refresh(): Promise<void> {
    const versions = await this.backend.versions();
    const changed = Object.keys(versions).filter((id) => versions[id] !== this.versionOf[id] && !this.unsaved.has(id));
    const fetched = await Promise.all(changed.map(async (id) => [id, await this.backend.plan(id)] as const));
    for (const [id, got] of fetched) {
      if (!got) continue;
      this.plans[id] = got.entry;
      this.versionOf[id] = got.version;
    }
    // Deleted elsewhere.
    for (const id of Object.keys(this.plans)) {
      if (!(id in versions) && !this.unsaved.has(id) && this.versionOf[id]) {
        delete this.plans[id];
        delete this.versionOf[id];
      }
    }
    this.invitesById = await this.backend.invites();
    this.loaded = true;
  }

  get ready(): boolean {
    return this.loaded;
  }

  get(planId: string): PlanEntry | undefined {
    return this.plans[planId];
  }

  list(): Plan[] {
    return Object.values(this.plans).map((e) => e.plan);
  }

  update<T>(planId: string, fn: (entry: PlanEntry | undefined) => { entry: PlanEntry; result: T }): T {
    const { entry, result } = fn(this.plans[planId]);
    this.plans[planId] = entry;
    this.persist(planId);
    return result;
  }

  remove(planId: string) {
    delete this.plans[planId];
    this.persist(planId);
  }

  invite(memberId: string): PendingInvite | undefined {
    return this.invitesById[memberId];
  }

  setInvite(memberId: string, invite: PendingInvite | null) {
    if (invite) this.invitesById[memberId] = invite;
    else delete this.invitesById[memberId];
    this.enqueue(() => this.backend.saveInvite(memberId, invite));
  }

  // Waits for every write so far; throws the first that failed.
  async flush(): Promise<void> {
    await this.queue;
    const [first] = this.failures;
    this.failures = [];
    if (first) throw first;
  }

  private persist(planId: string) {
    this.unsaved.set(planId, (this.unsaved.get(planId) ?? 0) + 1);
    this.enqueue(async () => {
      try {
        // The latest copy when this save runs; later writes queue their own.
        const entry = this.plans[planId] ?? null;
        const version = await this.backend.save(planId, entry, this.versionOf[planId] ?? 0);
        if (entry) this.versionOf[planId] = version;
        else delete this.versionOf[planId];
      } finally {
        const left = (this.unsaved.get(planId) ?? 1) - 1;
        if (left > 0) this.unsaved.set(planId, left);
        else this.unsaved.delete(planId);
      }
    });
  }

  private enqueue(write: () => Promise<void>) {
    this.queue = this.queue.then(write).catch((e: Error) => {
      // A conflict: read the trip again next time instead of our copy.
      if (e instanceof StoreConflict) delete this.versionOf[e.planId];
      this.failures.push(e);
    });
  }
}
