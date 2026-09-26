import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, Dialog, Field, Heading, Notice, PageHeader, TextInput, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { PersonRow, personState } from "../components/PersonRow.tsx";
import { WhoGoes } from "../components/WhoGoes.tsx";
import { usePanel } from "../data/store.tsx";

// Who can get into the group's site (SPEC §5).
export function PersonasPage() {
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

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Invitación copiada");
    } catch {
      // Some browsers refuse clipboard access; the link is shown in the row.
      toast("No se pudo copiar: selecciona el enlace a mano");
    }
  };

  // Every change here goes to the site; say so when it fails.
  const run = async (what: () => Promise<unknown>, done?: string) => {
    try {
      await what();
      if (done) toast(done);
    } catch (e) {
      toast(`No se pudo: ${(e as Error).message}`);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const m = await addMember(name);
      if (!m) return toast("Ya hay alguien con ese nombre");
      setName("");
      toast(`${m.name} añadido. Créale una invitación.`);
    });
  };

  const who = state.members.find((m) => m.id === revoking);

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader
          title="Personas"
          subtitle={`Quién puede entrar en el sitio del grupo · ${count("inside")} dentro · ${count("pending")} con invitación pendiente · ${count("expired") + count("none")} sin entrar`}
        />

        {state.status && !state.status.site.reachable && (
          <Notice>No se puede hablar con el sitio ({state.status.site.url}): {state.status.site.error}. Revisa la dirección y el token con npm run setup.</Notice>
        )}

        <GroupCard />
        {state.plan && state.members.length > 0 && <TripCard />}

        <Notice tone="neutral">
          Cada invitación sirve una vez y caduca en 7 días: quien la abre elige un PIN de 4 números y desde entonces entra con su nombre y ese PIN desde cualquier dispositivo. Si alguien reenvía una invitación ya usada, no sirve. Si alguien olvida su PIN, mándale una invitación nueva.
        </Notice>

        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {state.members.map((m) => (
            <PersonRow
              key={m.id}
              member={m}
              access={byId.get(m.id)!}
              now={now}
              onInvite={() => void run(async () => copy(await invite(m.id)))}
              onCopy={copy}
              onCloseSessions={() => void run(() => closeSessions(m.id), `${m.name} tendrá que volver a entrar con su PIN`)}
              onRevoke={() => setRevoking(m.id)}
            />
          ))}
        </ul>

        <Card as="form" variant="muted" onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Añadir a alguien" className="flex-1">
            {({ inputId }) => <TextInput id={inputId} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Button type="submit" variant="dark" className="h-[46px]" disabled={!name.trim()}>
            Añadir
          </Button>
        </Card>
      </main>

      <Dialog
        open={revoking !== null}
        title={`¿Quitar el acceso a ${who?.name ?? ""}?`}
        confirmLabel="Quitar acceso"
        tone="warning"
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          const id = revoking;
          setRevoking(null);
          if (id) void run(() => revoke(id), `${who?.name} ya no puede entrar. Mándale una invitación nueva cuando quieras.`);
        }}
      >
        Se borran su PIN y sus passkeys y se cierran sus sesiones en todos sus dispositivos. Sus votos y comentarios se quedan.
      </Dialog>
    </PanelShell>
  );
}

// The group's name and the organiser's, shown on the site (SPEC §11).
function GroupCard() {
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
      toast("Guardado en el sitio");
    } catch (err) {
      toast(`No se pudo guardar: ${(err as Error).message}`);
    }
  };

  return (
    <Card as="form" variant="flat" onSubmit={save} aria-labelledby="grupo" className="flex flex-col gap-4">
      <Heading id="grupo" size="subheading">
        El grupo
      </Heading>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Nombre del grupo" className="flex-1">
          {({ inputId }) => <TextInput id={inputId} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Grupo 51" />}
        </Field>
        <Field label="Tu nombre" className="flex-1">
          {({ inputId }) => <TextInput id={inputId} value={organiserName} onChange={(e) => setOrganiserName(e.target.value)} placeholder="Como te conoce el grupo" />}
        </Field>
        <Button type="submit" variant="dark" className="h-[46px]" disabled={!dirty || !groupName.trim() || !organiserName.trim()}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

// Who goes on the selected trip; the site shows it only to them.
function TripCard() {
  const { state, setParticipants } = usePanel();
  const toast = useToast();
  const plan = state.plan!;
  const [going, setGoing] = useState(state.participants);
  useEffect(() => setGoing(state.participants), [state.participants]);
  const dirty = going.length !== state.participants.length || going.some((id) => !state.participants.includes(id));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setParticipants(going);
      toast(`Guardado: ${going.length} ${going.length === 1 ? "persona va" : "personas van"} a ${plan.name}`);
    } catch (err) {
      toast(`No se pudo guardar: ${(err as Error).message}`);
    }
  };

  return (
    <Card as="form" variant="flat" onSubmit={save} aria-label={`Quién va a ${plan.name}`} className="flex flex-col gap-4">
      <WhoGoes people={state.members} value={going} onChange={setGoing} legend={`Quién va a ${plan.name}`} />
      <div>
        <Button type="submit" variant="primary" disabled={!dirty}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}
