// A software passkey for tests: creates and uses real P-256 credentials the
// way a phone's authenticator would ("none" attestation), so the site's
// SimpleWebAuthn verification runs for real.
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const sha = (b: Uint8Array | string) => new Uint8Array(createHash("sha256").update(b).digest());
const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const concat = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));

// Just enough CBOR for attestation objects and COSE keys.
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function head(major: number, n: number): Uint8Array {
  if (n < 24) return new Uint8Array([(major << 5) | n]);
  if (n < 256) return new Uint8Array([(major << 5) | 24, n]);
  if (n < 65536) return new Uint8Array([(major << 5) | 25, n >> 8, n & 255]);
  return concat(new Uint8Array([(major << 5) | 26]), u32(n));
}
function cbor(v: Cbor): Uint8Array {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") {
    const bytes = new TextEncoder().encode(v);
    return concat(head(3, bytes.length), bytes);
  }
  if (v instanceof Uint8Array) return concat(head(2, v.length), v);
  return concat(head(5, v.size), ...[...v].flatMap(([k, val]) => [cbor(k), cbor(val)]));
}

interface Credential {
  id: Uint8Array;
  privateKey: KeyObject;
  userHandle: string;
  counter: number;
}

export class SoftAuthenticator {
  readonly credentials: Credential[] = [];

  constructor(
    private origin: string,
    private rpId = new URL(origin).hostname,
  ) {}

  register(options: PublicKeyCredentialCreationOptionsJSON): RegistrationResponseJSON {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = publicKey.export({ format: "jwk" });
    const cose = cbor(
      new Map<Cbor, Cbor>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, new Uint8Array(Buffer.from(jwk.x!, "base64url"))],
        [-3, new Uint8Array(Buffer.from(jwk.y!, "base64url"))],
      ]),
    );
    const id = new Uint8Array(sha(`${Math.random()}`).slice(0, 16));
    const authData = concat(
      sha(this.rpId),
      new Uint8Array([0x45]), // user present + verified + attested credential data
      u32(0),
      new Uint8Array(16), // aaguid
      new Uint8Array([0, id.length]),
      id,
      cose,
    );
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: "webauthn.create", challenge: options.challenge, origin: this.origin, crossOrigin: false }),
    );
    const attestationObject = cbor(
      new Map<Cbor, Cbor>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    this.credentials.push({ id, privateKey, userHandle: options.user.id, counter: 0 });
    return {
      id: b64u(id),
      rawId: b64u(id),
      type: "public-key",
      response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ["internal"] },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  // Signs in with the most recent credential, as a discoverable passkey would.
  login(options: PublicKeyCredentialRequestOptionsJSON, which = this.credentials.length - 1): AuthenticationResponseJSON {
    const cred = this.credentials[which];
    if (!cred) throw new Error("no passkey on this authenticator");
    cred.counter += 1;
    const authData = concat(sha(this.rpId), new Uint8Array([0x05]), u32(cred.counter));
    const clientDataJSON = new TextEncoder().encode(
      JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: this.origin, crossOrigin: false }),
    );
    const signature = sign("sha256", concat(authData, sha(clientDataJSON)), cred.privateKey);
    return {
      id: b64u(cred.id),
      rawId: b64u(cred.id),
      type: "public-key",
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(new Uint8Array(signature)),
        userHandle: cred.userHandle,
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }
}
