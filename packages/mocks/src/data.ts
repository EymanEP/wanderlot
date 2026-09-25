// Mock data for "Noviembre 2026", matching the design canvas. Everything here
// is placeholder: it stands in for the panel's store and the site's API until
// those are wired up.
import {
  totalPerPersonCents,
  type Ballot,
  type Comment,
  type Destination,
  type Plan,
  type Proposal,
} from "@wanderlot/core";
import { leg, stay, things, type ProposalSpec } from "./build.ts";

// The designs are drawn on this day. Relative times ("hace 4 horas") and the
// vote countdown are computed against it so screens stay stable.
export const MOCK_NOW = new Date("2026-09-25T10:00:00Z");

export const PLAN_ID = "noviembre-2026";
const OUT = "2026-11-07";
const BACK = "2026-11-14";

// --- people ---------------------------------------------------------------

export type AvatarTint = "accent" | "sand" | "lilac" | "mint" | "sky" | "rose";

export interface MockMember {
  id: string;
  name: string;
  initials: string;
  tint: AvatarTint;
}

export const members: MockMember[] = [
  { id: "eyman", name: "Eyman", initials: "EP", tint: "accent" },
  { id: "marta", name: "Marta", initials: "MG", tint: "sand" },
  { id: "ivan", name: "Iván", initials: "IV", tint: "lilac" },
  { id: "ruben", name: "Rubén", initials: "RB", tint: "mint" },
  { id: "laura", name: "Laura", initials: "LC", tint: "sky" },
  { id: "diego", name: "Diego", initials: "DS", tint: "rose" },
];

// The organiser, and the person viewing the site in these mocks.
export const ME = members[0]!;

// --- plans ----------------------------------------------------------------

export const plans: Plan[] = [
  {
    id: PLAN_ID,
    name: "Noviembre 2026",
    origin: "MAD",
    dateFrom: OUT,
    dateTo: BACK,
    nights: 7,
    flexDays: 0,
    partySize: 6,
    maxPriceCents: 42000,
    status: "voting",
    voteDeadline: "2026-10-10T23:59:00+02:00",
  },
  {
    id: "semana-santa-2027",
    name: "Semana Santa 2027",
    origin: "MAD",
    dateFrom: "2027-03-23",
    dateTo: "2027-03-28",
    nights: 5,
    flexDays: 1,
    partySize: 6,
    maxPriceCents: 45000,
    status: "draft",
  },
  {
    id: "puente-mayo-2026",
    name: "Puente de mayo 2026",
    origin: "MAD",
    dateFrom: "2026-04-30",
    dateTo: "2026-05-03",
    nights: 3,
    flexDays: 0,
    partySize: 6,
    maxPriceCents: 30000,
    status: "closed",
    winnerDestinationId: "opo",
  },
];

export const plan = plans[0]!;

// --- proposals (panel) ----------------------------------------------------

const checked = "2026-09-24T10:12:00Z";
const api = { kind: "api" as const, provider: "duffel" as const, checkedAt: checked };

const specs: ProposalSpec[] = [
  {
    id: "lis",
    place: { city: "Lisboa", country: "Portugal", iata: "LIS" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "LIS", date: OUT, depart: "07:10", minutes: 80, carrier: "TAP Air Portugal", flightNumber: "TP 1017", euros: 90 }),
    inbound: leg({ from: "LIS", to: "MAD", date: BACK, depart: "19:05", minutes: 75, carrier: "TAP Air Portugal", flightNumber: "TP 1018", euros: 84 }),
    stays: [
      stay("Piso entero para 6 · Alfama", 34, { description: "Terraza con vistas al río · 3 habitaciones", recommended: true }),
      stay("Hotel boutique · Baixa", 44, { kind: "Hotel", description: "3 dobles · desayuno incluido" }),
    ],
    todo: things(
      ["Tranvía 28 de punta a punta", "Mejor a primera hora, antes de que se llene"],
      ["Pastéis de Belém recién hechos", "La cola avanza rápido; 1,40 € la unidad"],
      ["Excursión a Sintra", "Tren desde Rossio, 40 min; un día entero"],
      ["Cena con fado en Alfama", "Mejor una tasca pequeña que un espectáculo"],
      ["Atardecer en el mirador de Senhora do Monte", "Gratis, el más alto de la ciudad"],
    ),
    see: things(
      ["Torre de Belém", "Por fuera basta; dentro hay poco"],
      ["Monasterio de los Jerónimos", "Entrada con hora; el claustro merece la pena"],
      ["LX Factory", "Antigua fábrica con librerías y bares"],
      ["Castillo de San Jorge", "Vistas de toda la Baixa"],
    ),
    provenance: api,
    review: "approved",
  },
  {
    id: "nap",
    place: { city: "Nápoles", country: "Italia", iata: "NAP" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "NAP", date: OUT, depart: "07:20", minutes: 155, carrier: "Ryanair", flightNumber: "FR 8564", euros: 52 }),
    inbound: leg({ from: "NAP", to: "MAD", date: BACK, depart: "10:30", minutes: 165, carrier: "Ryanair", flightNumber: "FR 8565", euros: 49 }),
    stays: [
      stay("Piso entero, 3 habitaciones · Chiaia", 41, { description: "A 15 min andando del centro · 7 noches para 6 personas", recommended: true }),
      stay("B&B, 3 dobles · Quartieri Spagnoli", 35, { kind: "B&B", description: "Más céntrico y más ruidoso · desayuno incluido" }),
    ],
    todo: things(
      ["Subir al cráter del Vesubio", "10 € la entrada y una hora de subida desde el aparcamiento"],
      ["Pizza en Da Michele o Sorbillo", "Se coge número y se espera en la calle; la margarita ronda los 6 €"],
      ["Ferry a Sorrento y Positano", "Salen del Molo Beverello, una hora de travesía"],
      ["Bajar a la Nápoles subterránea", "Acueductos griegos y refugios de la guerra, solo con guía"],
      ["Ver al Nápoles en el Maradona", "Solo si juegan en casa esa semana; las entradas vuelan"],
    ),
    see: things(
      ["Pompeya", "La ciudad romana entera; hacen falta tres o cuatro horas"],
      ["Spaccanapoli", "La calle recta que parte el casco viejo en dos"],
      ["Museo Arqueológico Nacional", "Los mosaicos y bronces que sacaron de Pompeya"],
      ["El Cristo Velado", "En la Capilla Sansevero; entrada con hora y se agota"],
      ["Castel dell'Ovo al atardecer", "Gratis, con el Vesubio de fondo"],
    ),
    provenance: api,
    review: "approved",
  },
  {
    id: "rak",
    place: { city: "Marrakech", country: "Marruecos", iata: "RAK" },
    category: "escapada",
    outbound: leg({ from: "MAD", to: "RAK", date: OUT, depart: "09:40", minutes: 115, carrier: "Ryanair", flightNumber: "FR 5406", euros: 80 }),
    inbound: leg({ from: "RAK", to: "MAD", date: BACK, depart: "12:15", minutes: 110, carrier: "Ryanair", flightNumber: "FR 5407", euros: 73 }),
    stays: [
      stay("Riad entero en la Medina", 29, { kind: "Riad", description: "Patio con fuente · 3 habitaciones · desayuno", recommended: true }),
      stay("Villa con piscina · Palmeraie", 38, { kind: "Villa", description: "A 20 min en taxi de la plaza" }),
    ],
    todo: things(
      ["Noche en el desierto de Agafay", "A 40 min; cena y duermes en jaima"],
      ["Hammam tradicional", "El de barrio cuesta 10 €; el de hotel, 40"],
      ["Perderse en el zoco", "Regatear es parte del plan"],
      ["Clase de cocina marroquí", "Tajín y pan; unas 3 horas"],
    ),
    see: things(
      ["Plaza Jemaa el-Fna al anochecer", "Cuando montan los puestos de comida"],
      ["Jardín Majorelle", "Entrada con hora; mejor por la mañana"],
      ["Palacio de la Bahía", "Mosaicos y patios del siglo XIX"],
      ["Medersa Ben Youssef", "La escuela coránica más grande del Magreb"],
    ),
    provenance: api,
    review: "approved",
  },
  {
    id: "bud",
    place: { city: "Budapest", country: "Hungría", iata: "BUD" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "BUD", date: OUT, depart: "06:50", minutes: 185, carrier: "Wizz Air", flightNumber: "W6 2334", euros: 88 }),
    inbound: leg({ from: "BUD", to: "MAD", date: BACK, depart: "10:20", minutes: 190, carrier: "Wizz Air", flightNumber: "W6 2335", euros: 83 }),
    stays: [
      stay("Piso para 6 · Erzsébetváros", 33, { description: "El barrio judío, al lado de los bares", recommended: true }),
      stay("Aparthotel · Buda", 37, { kind: "Aparthotel", description: "Más tranquilo, junto al castillo" }),
    ],
    todo: things(
      ["Baños Széchenyi", "Al aire libre aunque haga frío; 30 € la entrada"],
      ["Ruin bars del barrio judío", "Empezar por Szimpla Kert"],
      ["Crucero nocturno por el Danubio", "Una hora, con el Parlamento iluminado"],
      ["Mercado Central", "Para comer lángos en la planta de arriba"],
    ),
    see: things(
      ["Parlamento", "Visita guiada; hay que reservar"],
      ["Bastión de los Pescadores", "Gratis antes de las 9"],
      ["Puente de las Cadenas", "Cruzarlo andando al atardecer"],
      ["Gran Sinagoga", "La más grande de Europa"],
    ),
    provenance: api,
    review: "approved",
  },
  {
    id: "tfs",
    place: { city: "Tenerife Sur", country: "España", iata: "TFS" },
    category: "playa",
    outbound: leg({ from: "MAD", to: "TFS", date: OUT, depart: "08:05", minutes: 190, carrier: "Iberia Express", flightNumber: "I2 3918", euros: 80 }),
    inbound: leg({ from: "TFS", to: "MAD", date: BACK, depart: "15:30", minutes: 165, carrier: "Iberia Express", flightNumber: "I2 3919", euros: 78 }),
    stays: [stay("Casa con piscina · Adeje", 26, { description: "Coche de alquiler imprescindible", recommended: true })],
    todo: things(["Subir al Teide", "Teleférico; reservar con semanas"], ["Avistamiento de cetáceos", "Salen de Los Cristianos"]),
    see: things(["Masca", "Pueblo colgado en el barranco"]),
    provenance: api,
    review: "pending",
  },
  {
    id: "opo",
    place: { city: "Oporto", country: "Portugal", iata: "OPO" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "OPO", date: OUT, depart: "16:45", minutes: 85, carrier: "Ryanair", flightNumber: "FR 5483", euros: 79 }),
    inbound: leg({ from: "OPO", to: "MAD", date: BACK, depart: "18:55", minutes: 80, carrier: "Ryanair", flightNumber: "FR 5484", euros: 76 }),
    stays: [stay("Piso en Ribeira", 31, { description: "Junto al puente Don Luis I", recommended: true })],
    todo: things(["Bodegas de Vila Nova de Gaia", "Cata con tres oportos por 15 €"], ["Francesinha en Café Santiago"]),
    see: things(["Librería Lello"], ["Estación de São Bento"]),
    provenance: api,
    review: "pending",
  },
  {
    id: "edi",
    place: { city: "Edimburgo", country: "Escocia", iata: "EDI" },
    category: "naturaleza",
    outbound: leg({ from: "MAD", to: "EDI", date: OUT, depart: "06:30", minutes: 345, carrier: "Vueling", flightNumber: "VY 8812", euros: 104, stops: 1 }),
    inbound: leg({ from: "EDI", to: "MAD", date: BACK, depart: "11:10", minutes: 330, carrier: "Vueling", flightNumber: "VY 8813", euros: 100, stops: 1 }),
    stays: [stay("Piso para 6 · Leith", 38, { description: "Barrio del puerto, a 20 min del centro", recommended: true })],
    todo: things(["Subir a Arthur's Seat", "Una hora de caminata"], ["Excursión a las Highlands", "Un día entero en furgoneta"], ["Destilería de whisky"]),
    see: things(["Royal Mile"], ["Castillo de Edimburgo"], ["Dean Village"], ["Calton Hill al atardecer"]),
    provenance: {
      kind: "claude",
      sources: [
        { label: "Vueling · búsqueda de vuelos", url: "https://www.vueling.com/es" },
        { label: "Skyscanner · MAD–EDI noviembre", url: "https://www.skyscanner.es" },
        { label: "Airbnb · Leith", url: "https://www.airbnb.es" },
      ],
    },
    review: "pending",
  },
  {
    id: "fco",
    place: { city: "Roma", country: "Italia", iata: "FCO" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "FCO", date: OUT, depart: "07:15", minutes: 150, carrier: "ITA Airways", flightNumber: "AZ 63", euros: 74 }),
    inbound: leg({ from: "FCO", to: "MAD", date: BACK, depart: "19:40", minutes: 155, carrier: "ITA Airways", flightNumber: "AZ 62", euros: 69 }),
    stays: [stay("Piso en Trastevere", 36, { recommended: true })],
    todo: things(["Cena en Trastevere"], ["Vespa por la Via Appia"]),
    see: things(["Coliseo y Foro"], ["Museos Vaticanos"], ["Panteón"]),
    // Checked five days before the mock "now": stale (SPEC §3).
    provenance: { kind: "api", provider: "duffel", checkedAt: "2026-09-20T09:00:00Z" },
    review: "pending",
  },
  {
    id: "prg",
    place: { city: "Praga", country: "Chequia", iata: "PRG" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "PRG", date: OUT, depart: "08:40", minutes: 170, carrier: "Iberia", flightNumber: "IB 3150", euros: 66 }),
    inbound: leg({ from: "PRG", to: "MAD", date: BACK, depart: "12:30", minutes: 180, carrier: "Iberia", flightNumber: "IB 3151", euros: 63 }),
    stays: [stay("Piso en Malá Strana", 27, { recommended: true })],
    todo: things(["Cervecerías de Vinohrady"], ["Concierto en una iglesia"]),
    see: things(["Puente de Carlos"], ["Castillo de Praga"], ["Reloj astronómico"]),
    provenance: api,
    review: "pending",
  },
  {
    id: "krk",
    place: { city: "Cracovia", country: "Polonia", iata: "KRK" },
    category: "escapada",
    outbound: leg({ from: "MAD", to: "KRK", date: OUT, depart: "06:55", minutes: 195, carrier: "Ryanair", flightNumber: "FR 7612", euros: 72 }),
    inbound: leg({ from: "KRK", to: "MAD", date: BACK, depart: "10:05", minutes: 200, carrier: "Ryanair", flightNumber: "FR 7613", euros: 72 }),
    stays: [stay("Piso en Kazimierz", 22, { recommended: true })],
    todo: things(["Minas de sal de Wieliczka"], ["Pierogi en Kazimierz"]),
    see: things(["Plaza del Mercado"], ["Castillo de Wawel"]),
    provenance: {
      kind: "claude",
      sources: [
        { label: "Ryanair · MAD–KRK", url: "https://www.ryanair.com/es/es" },
        { label: "Booking · Kazimierz", url: "https://www.booking.com" },
      ],
    },
    review: "pending",
  },
  {
    id: "mla",
    place: { city: "Malta", country: "Malta", iata: "MLA" },
    category: "playa",
    outbound: leg({ from: "MAD", to: "MLA", date: OUT, depart: "10:30", minutes: 150, carrier: "Ryanair", flightNumber: "FR 9901", euros: 75 }),
    inbound: leg({ from: "MLA", to: "MAD", date: BACK, depart: "13:40", minutes: 160, carrier: "Ryanair", flightNumber: "FR 9902", euros: 70 }),
    stays: [stay("Casa en Sliema", 39, { recommended: true })],
    todo: things(["Barco a Comino"]),
    see: things(["La Valeta"], ["Mdina"]),
    provenance: api,
    review: "discarded",
  },
  {
    id: "ath",
    place: { city: "Atenas", country: "Grecia", iata: "ATH" },
    category: "ciudad",
    outbound: leg({ from: "MAD", to: "ATH", date: OUT, depart: "11:25", minutes: 225, carrier: "Aegean", flightNumber: "A3 691", euros: 98 }),
    inbound: leg({ from: "ATH", to: "MAD", date: BACK, depart: "07:00", minutes: 245, carrier: "Aegean", flightNumber: "A3 690", euros: 93 }),
    stays: [stay("Piso en Plaka", 35, { recommended: true })],
    todo: things(["Cabo Sunión al atardecer"]),
    see: things(["Acrópolis"], ["Ágora antigua"]),
    provenance: api,
    review: "discarded",
  },
];

export const proposals: Proposal[] = specs.map((s) => ({ ...s, planId: PLAN_ID }));

// --- editorial (Comparativa) ----------------------------------------------

export interface Editorial {
  pros: string[];
  cons: string[];
  weather: string;
  inVote: boolean;
}

export const editorial: Record<string, Editorial> = {
  lis: {
    pros: ["El vuelo más corto de los cuatro", "Piso entero para 6 en Alfama", "Sintra y Cascais en cercanías"],
    cons: ["Media cuadrilla ya ha estado", "Noviembre es de los meses con más lluvia"],
    weather: "17 °C · lluvioso",
    inVote: true,
  },
  nap: {
    pros: ["El vuelo más barato de los cuatro", "Pompeya y el Vesubio en el mismo viaje", "Base cómoda para la Costa Amalfitana"],
    cons: ["El transporte local es irregular", "Moverse en grupo de 6 por el casco viejo cuesta"],
    weather: "18 °C · alguna lluvia",
    inVote: true,
  },
  rak: {
    pros: ["El total más bajo de los cuatro", "El mejor tiempo en noviembre", "Riad entero para nosotros seis"],
    cons: ["Fuera de la UE: hay que mirar seguro de viaje", "Menos vida nocturna que los otros tres"],
    weather: "23 °C · seco",
    inVote: true,
  },
  bud: {
    pros: ["Balnearios Széchenyi y Gellért", "Lo más barato del grupo en comer y salir", "Todo a pie o en metro, sin coche"],
    cons: ["9 °C de media: hará frío de verdad", "Anochece sobre las 16:00"],
    weather: "9 °C · frío",
    inVote: true,
  },
};

// Photos aren't sourced yet (SPEC §6): these label the placeholders.
export const photoLabels: Record<string, { hero: string; tiles: string[]; count: number }> = {
  lis: { hero: "Tranvía en Alfama", tiles: ["Belém", "Miradouro", "El piso"], count: 12 },
  nap: { hero: "Bahía de Nápoles", tiles: ["Pompeya", "Spaccanapoli", "El piso"], count: 12 },
  rak: { hero: "Jemaa el-Fna", tiles: ["Desierto de Agafay", "El riad", "Zoco"], count: 9 },
  bud: { hero: "Parlamento", tiles: ["Baños Széchenyi", "Danubio", "El piso"], count: 11 },
};

// --- destinations (site) --------------------------------------------------

export const destinations: Destination[] = proposals
  .filter((p) => p.review === "approved")
  .map(({ review: _r, planId: _p, ...p }) => ({
    ...p,
    ...editorial[p.id]!,
    photos: [],
    totalPerPersonCents: totalPerPersonCents(p, plan.nights, plan.partySize),
    approvedAt: "2026-09-24T18:30:00Z",
  }));

// --- votes ----------------------------------------------------------------

const ballot = (memberId: string, ranking: string[], castAt: string): Ballot => ({
  memberId,
  ranking,
  castAt,
  updatedAt: castAt,
});

// Four of six have voted: the state the Votación design shows.
export const ballots: Ballot[] = [
  ballot("eyman", ["rak", "lis", "bud"], "2026-09-21T19:02:00Z"),
  ballot("marta", ["nap", "lis", "rak"], "2026-09-22T08:40:00Z"),
  ballot("ivan", ["rak", "nap", "bud"], "2026-09-22T21:15:00Z"),
  ballot("ruben", ["lis", "nap", "rak"], "2026-09-24T12:30:00Z"),
];

// The last two ballots, for previewing the closed scoreboard.
export const lateBallots: Ballot[] = [
  ballot("laura", ["nap", "rak", "lis"], "2026-10-02T10:00:00Z"),
  ballot("diego", ["bud", "nap", "rak"], "2026-10-09T22:45:00Z"),
];

// --- comments -------------------------------------------------------------

export interface MockComment extends Comment {
  likes: number;
}

const comment = (
  id: string,
  memberId: string,
  destinationId: string,
  createdAt: string,
  body: string,
  extra: { parentId?: string; likes?: number } = {},
): MockComment => ({
  id,
  planId: PLAN_ID,
  destinationId,
  memberId,
  body,
  createdAt,
  likes: extra.likes ?? 0,
  ...(extra.parentId ? { parentId: extra.parentId } : {}),
});

export const comments: MockComment[] = [
  comment("c1", "marta", "nap", "2026-09-23T09:00:00Z", "La Circumvesuviana a Pompeya sale cada media hora pero va hasta arriba. Si vamos, hay que madrugar de verdad, no a las once.", { likes: 3 }),
  comment("c2", "ivan", "nap", "2026-09-24T09:30:00Z", "Por mí perfecto. Saliendo a las 8 de casa vamos sobrados y comemos allí.", { parentId: "c1" }),
  comment("c3", "ruben", "nap", "2026-09-25T06:00:00Z", "¿Los 41 € por noche llevan la tasa turística? En Roma nos clavaron 6 € por persona y día y no estaba en el precio.", { likes: 1 }),
  comment("c4", "ivan", "rak", "2026-09-25T04:10:00Z", "Lo del desierto solo tiene sentido si dormimos allí. Ida y vuelta en el día es una paliza."),
  comment("c5", "eyman", "rak", "2026-09-24T20:05:00Z", "El riad tiene terraza en la azotea y el desayuno va incluido. Lo he mirado con calma.", { likes: 2 }),
  comment("c6", "laura", "lis", "2026-09-22T17:45:00Z", "Yo estuve en 2019 y repetiría sin dudarlo, pero entiendo que media cuadrilla quiera algo nuevo."),
  comment("c7", "ruben", "lis", "2026-09-22T19:20:00Z", "Si es Lisboa, Sintra sí o sí. Un día entero.", { parentId: "c6", likes: 1 }),
  comment("c8", "diego", "bud", "2026-09-21T11:00:00Z", "9 grados y anochece a las cuatro. Me encanta Budapest pero en noviembre no sé yo.", { likes: 2 }),
];

// City name for any destination id in the mocks (past plans' winners included).
export function placeName(id: string): string {
  return proposals.find((p) => p.id === id)?.place.city ?? id;
}

// --- who can get in (SPEC §5) ------------------------------------------------

export type InviteState = "valid" | "used" | "expired" | "cancelled";

export interface MockAccess {
  memberId: string;
  invite: { status: InviteState; createdAt: string; expiresAt: string; usedAt: string | null } | null;
  inviteUrl: string | null;
  passkeys: { device: string; createdAt: string; lastUsedAt: string | null }[];
  sessions: { device: string; createdAt: string; lastSeenAt: string }[];
}

export const SITE_URL = "https://wanderlot-grupo51.workers.dev";

const joined = (memberId: string, device: string, at: string, seen: string): MockAccess => ({
  memberId,
  invite: { status: "used", createdAt: "2026-09-15T18:00:00Z", expiresAt: "2026-09-22T18:00:00Z", usedAt: at },
  inviteUrl: null,
  passkeys: [{ device, createdAt: at, lastUsedAt: seen }],
  sessions: [{ device, createdAt: at, lastSeenAt: seen }],
});

// Four are in; Laura hasn't used her invite yet and Diego's ran out.
export const access: MockAccess[] = [
  {
    ...joined("eyman", "Safari en iPhone", "2026-09-15T18:05:00Z", "2026-09-25T08:10:00Z"),
    passkeys: [
      { device: "Safari en iPhone", createdAt: "2026-09-15T18:05:00Z", lastUsedAt: "2026-09-25T08:10:00Z" },
      { device: "Chrome en Mac", createdAt: "2026-09-16T09:30:00Z", lastUsedAt: "2026-09-24T21:00:00Z" },
    ],
    sessions: [
      { device: "Safari en iPhone", createdAt: "2026-09-15T18:05:00Z", lastSeenAt: "2026-09-25T08:10:00Z" },
      { device: "Chrome en Mac", createdAt: "2026-09-16T09:30:00Z", lastSeenAt: "2026-09-24T21:00:00Z" },
    ],
  },
  joined("marta", "Safari en iPhone", "2026-09-15T19:40:00Z", "2026-09-23T09:00:00Z"),
  joined("ivan", "Chrome en Android", "2026-09-16T12:15:00Z", "2026-09-25T04:10:00Z"),
  joined("ruben", "Safari en iPhone", "2026-09-17T20:02:00Z", "2026-09-25T06:00:00Z"),
  {
    memberId: "laura",
    invite: { status: "valid", createdAt: "2026-09-22T17:00:00Z", expiresAt: "2026-09-29T17:00:00Z", usedAt: null },
    inviteUrl: `${SITE_URL}/i/3kQ9vX2mT7pLw8Rz`,
    passkeys: [],
    sessions: [],
  },
  {
    memberId: "diego",
    invite: { status: "expired", createdAt: "2026-09-15T18:00:00Z", expiresAt: "2026-09-22T18:00:00Z", usedAt: null },
    inviteUrl: null,
    passkeys: [],
    sessions: [],
  },
];
