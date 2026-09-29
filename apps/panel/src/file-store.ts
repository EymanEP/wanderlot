// The panel's data in a JSON file on the organiser's laptop: how it was kept
// before the site could hold it (ROADMAP 3.2), still used with a site that's
// too old, and read once to move it to the site.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { memoryBackend, type PanelBackend, type PanelState } from "./store.ts";

export function readPanelFile(path: string): PanelState {
  try {
    const s = JSON.parse(readFileSync(path, "utf8")) as Partial<PanelState>;
    return { plans: s.plans ?? {}, invites: s.invites ?? {} };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { plans: {}, invites: {} };
    throw e;
  }
}

export function fileBackend(path: string): PanelBackend {
  const inner = memoryBackend(readPanelFile(path));
  const write = async () => {
    const state: PanelState = { plans: {}, invites: await inner.invites() };
    for (const id of Object.keys(await inner.versions())) state.plans[id] = (await inner.plan(id))!.entry;
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2));
    renameSync(tmp, path);
  };
  return {
    ...inner,
    async save(id, entry, version) {
      const v = await inner.save(id, entry, version);
      await write();
      return v;
    },
    async saveInvite(memberId, invite) {
      await inner.saveInvite(memberId, invite);
      await write();
    },
  };
}

// Moves the laptop's trips and invite links to the site, once: trips the
// site doesn't have yet go up, then the file is kept as a backup beside it.
// Resolves to how many trips went up.
export async function moveFileToSite(path: string, site: PanelBackend): Promise<number> {
  if (!existsSync(path)) return 0;
  const local = readPanelFile(path);
  const there = await site.versions();
  let moved = 0;
  for (const [id, entry] of Object.entries(local.plans)) {
    if (id in there) continue;
    await site.save(id, entry, 0);
    moved++;
  }
  const invites = await site.invites();
  for (const [memberId, invite] of Object.entries(local.invites)) {
    if (!invites[memberId] && Date.parse(invite.expiresAt) > Date.now()) await site.saveInvite(memberId, invite);
  }
  renameSync(path, `${path}.moved-to-site`);
  return moved;
}
