// Who is signed in (SPEC §5). Screens use useAuth(); the client behind it is
// either the real site API (PIN or passkey) or a mock for previews and tests.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { ME } from "@wanderlot/mocks";

export interface Member {
  id: string;
  name: string;
}

export type InviteStatus = "valid" | "used" | "expired" | "cancelled";

export interface GroupInfo {
  groupName: string;
  organiserName: string;
}

export interface AuthClient {
  // The group's name and organiser: public, for the sign-in screens.
  site(): Promise<GroupInfo>;
  session(): Promise<Member | null>;
  // Looking at an invite never uses it up.
  invite(token: string): Promise<{ name: string; status: InviteStatus } | null>;
  // With a PIN: works on any device.
  acceptInviteWithPin(token: string, pin: string): Promise<Member>;
  signInWithPin(name: string, pin: string): Promise<Member>;
  // With a passkey on this device, for those who want Face ID or a fingerprint.
  acceptInvite(token: string): Promise<Member>;
  signIn(): Promise<Member>;
  signOut(): Promise<void>;
  supported(): boolean;
}

// A message fit to show the person.
export class AuthError extends Error {}

function friendly(e: unknown): AuthError {
  const name = (e as { name?: string })?.name;
  // The person closed the passkey prompt or it timed out.
  if (name === "NotAllowedError" || name === "AbortError") return new AuthError("No se completó. Vuelve a intentarlo cuando quieras.");
  if (name === "InvalidStateError") return new AuthError("Este dispositivo ya tiene una passkey para ti. Usa «Entrar».");
  return e instanceof AuthError ? e : new AuthError((e as Error)?.message || "Algo ha fallado. Vuelve a intentarlo.");
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new AuthError(data.error ?? `Error ${res.status}`);
  return data as T;
}

// The real thing: the site API plus the browser's passkey prompt.
export const httpAuthClient: AuthClient = {
  async site() {
    const res = await fetch("/api/site");
    return res.ok ? ((await res.json()) as GroupInfo) : { groupName: "Wanderlot", organiserName: "quien organiza" };
  },
  async session() {
    const res = await fetch("/api/session", { credentials: "same-origin" });
    return res.ok ? ((await res.json()) as { member: Member }).member : null;
  },
  async invite(token) {
    const res = await fetch(`/api/invites/${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { member: { name: string }; status: InviteStatus };
    return { name: data.member.name, status: data.status };
  },
  async acceptInviteWithPin(token, pin) {
    return (await post<{ member: Member }>(`/api/invites/${encodeURIComponent(token)}/pin`, { pin })).member;
  },
  async signInWithPin(name, pin) {
    return (await post<{ member: Member }>("/api/session/pin", { name, pin })).member;
  },
  async acceptInvite(token) {
    try {
      const { flowId, options } = await post<{ flowId: string; options: never }>(`/api/invites/${encodeURIComponent(token)}/passkey/options`);
      const response = await startRegistration({ optionsJSON: options });
      return (await post<{ member: Member }>(`/api/invites/${encodeURIComponent(token)}/passkey/verify`, { flowId, response })).member;
    } catch (e) {
      throw friendly(e);
    }
  },
  async signIn() {
    try {
      const { flowId, options } = await post<{ flowId: string; options: never }>("/api/session/options");
      const response = await startAuthentication({ optionsJSON: options });
      return (await post<{ member: Member }>("/api/session/verify", { flowId, response })).member;
    } catch (e) {
      throw friendly(e);
    }
  },
  async signOut() {
    await fetch("/api/session", { method: "DELETE", credentials: "same-origin" });
  },
  supported: () => browserSupportsWebAuthn(),
};

// For previews and tests: always succeeds after a moment. Invite tokens
// "usada", "caducada" and "cancelada" show those states; any other is valid.
export function mockAuthClient(startSignedIn = true): AuthClient {
  let member: Member | null = startSignedIn ? { id: ME.id, name: ME.name } : null;
  const wait = () => new Promise((r) => setTimeout(r, 400));
  const states: Record<string, InviteStatus> = { usada: "used", caducada: "expired", cancelada: "cancelled" };
  return {
    site: async () => ({ groupName: "Grupo 51", organiserName: ME.name }),
    session: async () => member,
    invite: async (token) => ({ name: ME.name, status: states[token] ?? "valid" }),
    acceptInviteWithPin: async (_token, pin) => {
      await wait();
      if (!/^\d{6}$/.test(pin)) throw new AuthError("El PIN son 6 números");
      return (member = { id: ME.id, name: ME.name });
    },
    // The design's PIN for everyone is 480193.
    signInWithPin: async (name, pin) => {
      await wait();
      if (pin !== "480193" || !name.trim()) throw new AuthError("Nombre o PIN incorrectos");
      return (member = { id: ME.id, name: ME.name });
    },
    acceptInvite: async () => {
      await wait();
      return (member = { id: ME.id, name: ME.name });
    },
    signIn: async () => {
      await wait();
      return (member = { id: ME.id, name: ME.name });
    },
    signOut: async () => {
      member = null;
    },
    supported: () => true,
  };
}

type State = { status: "loading" } | { status: "out" } | { status: "in"; member: Member };

export interface AuthApi {
  state: State;
  group: GroupInfo;
  client: AuthClient;
  signIn: () => Promise<Member>;
  signInWithPin: (name: string, pin: string) => Promise<Member>;
  acceptInvite: (token: string) => Promise<Member>;
  acceptInviteWithPin: (token: string, pin: string) => Promise<Member>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ client, children }: { client: AuthClient; children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [group, setGroup] = useState<GroupInfo>({ groupName: "Wanderlot", organiserName: "quien organiza" });

  useEffect(() => {
    client.site().then(setGroup, () => {});
  }, [client]);

  useEffect(() => {
    let live = true;
    client.session().then(
      (m) => live && setState(m ? { status: "in", member: m } : { status: "out" }),
      () => live && setState({ status: "out" }),
    );
    return () => {
      live = false;
    };
  }, [client]);

  const enter = useCallback((m: Member) => {
    setState({ status: "in", member: m });
    return m;
  }, []);

  const api = useMemo<AuthApi>(
    () => ({
      state,
      group,
      client,
      signIn: () => client.signIn().then(enter),
      signInWithPin: (name, pin) => client.signInWithPin(name, pin).then(enter),
      acceptInvite: (token) => client.acceptInvite(token).then(enter),
      acceptInviteWithPin: (token, pin) => client.acceptInviteWithPin(token, pin).then(enter),
      signOut: async () => {
        await client.signOut();
        setState({ status: "out" });
      },
    }),
    [state, group, client, enter],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useAuth needs an <AuthProvider>");
  return api;
}
