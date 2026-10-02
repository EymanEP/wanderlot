import { useEffect, useState, type FormEvent } from "react";
import { copy } from "@wanderlot/core";
import { Button, Card, Dialog, Field, Heading, Notice, PageHeader, TextInput, useCopy, useToast } from "@wanderlot/ui";
import { OrganiserCard } from "../components/OrganiserCard.tsx";
import { PanelShell } from "../components/PanelShell.tsx";
import { PersonRow, personState } from "../components/PersonRow.tsx";
import { WhoGoes } from "../components/WhoGoes.tsx";
import { usePanel } from "../data/store.tsx";

const COPY = copy({
  es: {
    copied: "Invitación copiada",
    copyFailed: "No se pudo copiar: selecciona el enlace a mano",
    failed: (msg: string) => `No se pudo: ${msg}`,
    taken: "Ya hay alguien con ese nombre",
    added: (name: string) => `${name} añadido. Créale una invitación.`,
    title: "Personas",
    subtitle: (inside: number, pending: number, out: number) => `Quién puede entrar en el sitio del grupo · ${inside} dentro · ${pending} con invitación pendiente · ${out} sin entrar`,
    unreachable: (url: string, error: string) => `No se puede hablar con el sitio (${url}): ${error}. Revisa la dirección y el token con npm run setup.`,
    howInvites:
      "Cada invitación sirve una vez y caduca en 7 días: quien la abre elige un PIN de 4 números y desde entonces entra con su nombre y ese PIN desde cualquier dispositivo. Si alguien reenvía una invitación ya usada, no sirve. Si alguien olvida su PIN, mándale una invitación nueva.",
    closed: (name: string) => `${name} tendrá que volver a entrar con su PIN`,
    addSomeone: "Añadir a alguien",
    name: "Nombre",
    add: "Añadir",
    revokeTitle: (name: string) => `¿Quitar el acceso a ${name}?`,
    revoke: "Quitar acceso",
    revoked: (name: string) => `${name} ya no puede entrar. Mándale una invitación nueva cuando quieras.`,
    revokeText: "Se borran su PIN y sus passkeys y se cierran sus sesiones en todos sus dispositivos. Sus votos y comentarios se quedan.",
    savedSite: "Guardado en el sitio",
    saveFailed: (msg: string) => `No se pudo guardar: ${msg}`,
    group: "El grupo",
    groupName: "Nombre del grupo",
    groupHint: "Grupo 51",
    yourName: "Tu nombre",
    yourNameHint: "Como te conoce el grupo",
    save: "Guardar",
    savedGoing: (n: number, plan: string): string => `Guardado: ${n} ${n === 1 ? "persona va" : "personas van"} a ${plan}`,
    whoGoes: (plan: string) => `Quién va a ${plan}`,
  },
  en: {
    copied: "Invite copied",
    copyFailed: "Couldn't copy: select the link by hand",
    failed: (msg: string) => `Couldn't do it: ${msg}`,
    taken: "There's already someone with that name",
    added: (name: string) => `${name} added. Create an invite for them.`,
    title: "People",
    subtitle: (inside: number, pending: number, out: number) => `Who can get into the group's site · ${inside} in · ${pending} with a pending invite · ${out} not in`,
    unreachable: (url: string, error: string) => `Can't reach the site (${url}): ${error}. Check the address and the token with npm run setup.`,
    howInvites:
      "Each invite works once and expires in 7 days: whoever opens it picks a 4-digit PIN and from then on gets in with their name and that PIN from any device. If someone forwards an invite that's already been used, it won't work. If someone forgets their PIN, send them a new invite.",
    closed: (name: string) => `${name} will have to sign in again with their PIN`,
    addSomeone: "Add someone",
    name: "Name",
    add: "Add",
    revokeTitle: (name: string) => `Remove ${name}'s access?`,
    revoke: "Remove access",
    revoked: (name: string) => `${name} can no longer get in. Send them a new invite whenever you like.`,
    revokeText: "Their PIN and passkeys are deleted and their sessions are closed on all their devices. Their votes and comments stay.",
    savedSite: "Saved on the site",
    saveFailed: (msg: string) => `Couldn't save: ${msg}`,
    group: "The group",
    groupName: "Group name",
    groupHint: "Group 51",
    yourName: "Your name",
    yourNameHint: "What the group calls you",
    save: "Save",
    savedGoing: (n: number, plan: string): string => `Saved: ${n} ${n === 1 ? "person is" : "people are"} going to ${plan}`,
    whoGoes: (plan: string) => `Who's going to ${plan}`,
  },
});

// Who can get into the group's site (SPEC §5).
export function PersonasPage() {
  const t = useCopy(COPY);
  const { state, now, addMember, invite, closeSessions, revoke, refreshMembers } = usePanel();

  // Someone may have accepted an invite since: check on every visit.
  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);
  const toast = useToast();
  const [name, setName] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const byId = new Map(state.access.map((a) => [a.memberId, a]));
  const count = (s: string) => state.members.filter((m) => personState(byId.get(m.id)!) === s).length;

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t.copied);
    } catch {
      // Some browsers refuse clipboard access; the link is shown in the row.
      toast(t.copyFailed);
    }
  };

  // Every change here goes to the site; say so when it fails.
  const run = async (what: () => Promise<unknown>, done?: string) => {
    try {
      await what();
      if (done) toast(done);
    } catch (e) {
      toast(t.failed((e as Error).message));
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const m = await addMember(name);
      if (!m) return toast(t.taken);
      setName("");
      toast(t.added(m.name));
    });
  };

  const who = state.members.find((m) => m.id === revoking);

  return (
    <PanelShell trip={false}>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader
          title={t.title}
          subtitle={t.subtitle(count("inside"), count("pending"), count("expired") + count("none"))}
        />

        {state.status && !state.status.site.reachable && (
          <Notice>{t.unreachable(state.status.site.url, state.status.site.error ?? "")}</Notice>
        )}

        <GroupCard />
        <OrganiserCard />
        {state.plan && state.members.length > 0 && <TripCard />}

        <Notice tone="neutral">
          {t.howInvites}
        </Notice>

        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {state.members.map((m) => (
            <PersonRow
              key={m.id}
              member={m}
              access={byId.get(m.id)!}
              now={now}
              onInvite={() => void run(async () => copyLink(await invite(m.id)))}
              onCopy={copyLink}
              onCloseSessions={() => void run(() => closeSessions(m.id), t.closed(m.name))}
              onRevoke={() => setRevoking(m.id)}
            />
          ))}
        </ul>

        <Card as="form" variant="muted" onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t.addSomeone} className="flex-1">
            {({ inputId }) => <TextInput id={inputId} placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Button type="submit" variant="dark" className="h-[46px]" disabled={!name.trim()}>
            {t.add}
          </Button>
        </Card>
      </main>

      <Dialog
        open={revoking !== null}
        title={t.revokeTitle(who?.name ?? "")}
        confirmLabel={t.revoke}
        tone="warning"
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          const id = revoking;
          setRevoking(null);
          if (id) void run(() => revoke(id), t.revoked(String(who?.name)));
        }}
      >
        {t.revokeText}
      </Dialog>
    </PanelShell>
  );
}

// The group's name and the organiser's, shown on the site (SPEC §11).
function GroupCard() {
  const t = useCopy(COPY);
  const { state, saveSettings } = usePanel();
  const toast = useToast();
  const [groupName, setGroupName] = useState(state.settings?.groupName ?? "");
  const [organiserName, setOrganiserName] = useState(state.settings?.organiserName ?? "");
  useEffect(() => {
    setGroupName(state.settings?.groupName ?? "");
    setOrganiserName(state.settings?.organiserName ?? "");
  }, [state.settings]);
  const dirty = groupName !== (state.settings?.groupName ?? "") || organiserName !== (state.settings?.organiserName ?? "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await saveSettings({ ...state.settings, groupName: groupName.trim(), organiserName: organiserName.trim() });
      toast(t.savedSite);
    } catch (err) {
      toast(t.saveFailed((err as Error).message));
    }
  };

  return (
    <Card as="form" variant="flat" onSubmit={save} aria-labelledby="grupo" className="flex flex-col gap-4">
      <Heading id="grupo" size="subheading">
        {t.group}
      </Heading>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={t.groupName} className="flex-1">
          {({ inputId }) => <TextInput id={inputId} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t.groupHint} />}
        </Field>
        <Field label={t.yourName} className="flex-1">
          {({ inputId }) => <TextInput id={inputId} value={organiserName} onChange={(e) => setOrganiserName(e.target.value)} placeholder={t.yourNameHint} />}
        </Field>
        <Button type="submit" variant="dark" className="h-[46px]" disabled={!dirty || !groupName.trim() || !organiserName.trim()}>
          {t.save}
        </Button>
      </div>
    </Card>
  );
}

// Who goes on the selected trip; the site shows it only to them.
function TripCard() {
  const t = useCopy(COPY);
  const { state, setParticipants } = usePanel();
  const toast = useToast();
  const plan = state.plan!;
  const [going, setGoing] = useState(state.participants);
  useEffect(() => {
    setGoing(state.participants);
  }, [state.participants]);
  const dirty = going.length !== state.participants.length || going.some((id) => !state.participants.includes(id));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setParticipants(going);
      toast(t.savedGoing(going.length, plan.name));
    } catch (err) {
      toast(t.saveFailed((err as Error).message));
    }
  };

  return (
    <Card as="form" variant="flat" onSubmit={save} aria-label={t.whoGoes(plan.name)} className="flex flex-col gap-4">
      <WhoGoes people={state.members} value={going} onChange={setGoing} legend={t.whoGoes(plan.name)} />
      <div>
        <Button type="submit" variant="primary" disabled={!dirty}>
          {t.save}
        </Button>
      </div>
    </Card>
  );
}
