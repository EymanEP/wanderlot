import { useState, type FormEvent } from "react";
import { Button, Card, Dialog, Field, Notice, PageHeader, TextInput, useToast } from "@wanderlot/ui";
import { PanelShell } from "../components/PanelShell.tsx";
import { PersonRow, personState } from "../components/PersonRow.tsx";
import { usePanel } from "../data/store.tsx";

// Who can get into the group's site (SPEC §5).
export function PersonasPage() {
  const { state, now, addMember, invite, closeSessions, revoke } = usePanel();
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

  const add = (e: FormEvent) => {
    e.preventDefault();
    const m = addMember(name);
    if (!m) return toast("Ya hay alguien con ese nombre");
    setName("");
    toast(`${m.name} añadido. Créale una invitación.`);
  };

  const who = state.members.find((m) => m.id === revoking);

  return (
    <PanelShell>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-[26px] px-4 py-8 sm:px-8">
        <PageHeader
          title="Personas"
          subtitle={`Quién puede entrar en el sitio del grupo · ${count("inside")} dentro · ${count("pending")} con invitación pendiente · ${count("expired") + count("none")} sin entrar`}
        />

        <Notice tone="neutral">
          Cada invitación sirve una vez y caduca en 7 días: quien la abre crea su passkey (Face ID, huella o el PIN del móvil) y desde entonces entra con la dirección del sitio. Si alguien reenvía una invitación ya usada, no sirve.
        </Notice>

        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {state.members.map((m) => (
            <PersonRow
              key={m.id}
              member={m}
              access={byId.get(m.id)!}
              now={now}
              onInvite={() => {
                const url = invite(m.id);
                void copy(url);
              }}
              onCopy={copy}
              onCloseSessions={() => {
                closeSessions(m.id);
                toast(`${m.name} tendrá que volver a entrar con su passkey`);
              }}
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
          if (revoking) revoke(revoking);
          setRevoking(null);
          toast(`${who?.name} ya no puede entrar. Mándale una invitación nueva cuando quieras.`);
        }}
      >
        Se borran sus passkeys y se cierran sus sesiones en todos sus dispositivos. Sus votos y comentarios se quedan.
      </Dialog>
    </PanelShell>
  );
}
