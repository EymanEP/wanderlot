// Every component in the design system, in every state the screens use.
import { useState, type ReactNode } from "react";
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Avatar,
  Badge,
  BeachIcon,
  BookmarkIcon,
  Brand,
  BulletList,
  Button,
  Calendar,
  Card,
  CheckIcon,
  Checkbox,
  Chip,
  ChoiceChip,
  CityIcon,
  DataList,
  DataRow,
  EmptyState,
  Eyebrow,
  Field,
  Fieldset,
  FiltersIcon,
  GlobeIcon,
  Heading,
  HouseIcon,
  IataTile,
  IconButton,
  IconTabs,
  InfoPill,
  LockIcon,
  MountainIcon,
  Notice,
  PageHeader,
  Photo,
  ProsCons,
  ProvenanceBadge,
  RadioCard,
  Range,
  SearchIcon,
  SectionHeader,
  Select,
  Skeleton,
  StatTile,
  StatusDot,
  Stepper,
  Text,
  TextArea,
  TextInput,
  ToastProvider,
  TopBar,
  addDays,
  chipClasses,
  navLinkClasses,
  useToast,
  type AvatarTint,
} from "../src/index.ts";

const SECTIONS = [
  ["tokens", "Tokens"],
  ["type", "Tipografía"],
  ["buttons", "Botones"],
  ["badges", "Etiquetas"],
  ["chips", "Chips"],
  ["forms", "Formularios"],
  ["calendar", "Calendario"],
  ["cards", "Tarjetas"],
  ["data", "Datos"],
  ["media", "Fotos"],
  ["feedback", "Avisos"],
  ["layout", "Estructura"],
] as const;

export function Gallery() {
  return (
    <ToastProvider>
      <TopBar brand={<Brand sub="Sistema de diseño" />} end={<span className="text-sm text-muted">packages/ui</span>} />
      <div className="mx-auto flex max-w-[1200px] gap-10 px-4 py-10 sm:px-8">
        <nav aria-label="Secciones" className="sticky top-28 hidden h-fit w-44 shrink-0 flex-col gap-1 lg:flex">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={chipClasses("nav", false, "md") + " justify-start"}>
              {label}
            </a>
          ))}
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-16">
          <PageHeader
            size="display"
            title="Sistema de diseño"
            subtitle="Los componentes con los que están hechas las seis pantallas del panel y del sitio. Colores, tipos y medidas salen del lienzo de diseño."
          />
          <Tokens />
          <TypeSection />
          <Buttons />
          <Badges />
          <Chips />
          <Forms />
          <CalendarSection />
          <Cards />
          <DataSection />
          <MediaSection />
          <FeedbackSection />
          <LayoutSection />
        </main>
      </div>
    </ToastProvider>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-28 flex-col gap-6">
      <Heading size="heading">{title}</Heading>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const COLORS: [string, string][] = [
  ["ink", "#1A1A18"],
  ["ink-2", "#4A4A45"],
  ["muted", "#6B6B66"],
  ["faint", "#B8B8B2"],
  ["line", "#DCDCD6"],
  ["line-soft", "#E6E6E2"],
  ["surface-2", "#F7F7F5"],
  ["surface-3", "#F2F2EF"],
  ["surface-4", "#EFEFEB"],
  ["canvas", "#F9F9F7"],
  ["accent", "#0E6B60"],
  ["accent-strong", "#0A524A"],
  ["accent-soft", "#E4F0EE"],
  ["claude", "#8A5200"],
  ["claude-soft", "#FDF0DC"],
];

function Tokens() {
  return (
    <Section id="tokens" title="Tokens">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {COLORS.map(([name, hex]) => (
          <div key={name} className="flex flex-col gap-2">
            <div className="h-16 rounded-xl border border-line-soft" style={{ background: hex }} />
            <span className="text-[13px] font-bold">{name}</span>
            <span className="text-xs text-muted tabular-nums">{hex}</span>
          </div>
        ))}
      </div>
      <Row label="Radios y sombras">
        {(["rounded-xl shadow-card", "rounded-2xl shadow-raised", "rounded-tile shadow-pill", "rounded-card shadow-pop"] as const).map((c) => (
          <div key={c} className={`flex h-20 w-40 items-center justify-center bg-surface text-xs text-muted ${c}`}>
            {c}
          </div>
        ))}
      </Row>
    </Section>
  );
}

function TypeSection() {
  return (
    <Section id="type" title="Tipografía">
      <div className="flex flex-col gap-4">
        <Heading as="p" size="hero">Nápoles · hero</Heading>
        <Heading as="p" size="display">Noviembre 2026 · display</Heading>
        <Heading as="p" size="title">Comparativa · title</Heading>
        <Heading as="p" size="headline">Nueva búsqueda · headline</Heading>
        <Heading as="p" size="heading">Dónde dormimos · heading</Heading>
        <Heading as="p" size="subheading">Fuera de tu reparto · subheading</Heading>
        <Text size="lg">Texto grande: del sábado 7 al sábado 14 · salida desde Madrid.</Text>
        <Text>Texto normal: directo · 1 h 20 m · TAP Air Portugal · 174 € ida y vuelta.</Text>
        <Text size="sm" tone="muted">Texto pequeño apagado: precios consultados el 24 de septiembre de 2026.</Text>
      </div>
      <SectionHeader title="Encabezado de sección" aside="con un apunte a la derecha" />
    </Section>
  );
}

function Buttons() {
  return (
    <Section id="buttons" title="Botones">
      <Row label="Variantes">
        <Button variant="primary">Publicar 4 aprobadas</Button>
        <Button variant="secondary">Descartar</Button>
        <Button variant="soft">Aprobar</Button>
        <Button variant="dark">Comentar</Button>
        <Button variant="warning">Verificar con la API</Button>
        <Button variant="ghost">Responder</Button>
      </Row>
      <Row label="Tamaños">
        <Button variant="primary" size="lg" icon={<SearchIcon size={18} />}>
          Generar 12 propuestas
        </Button>
        <Button variant="secondary" size="md">
          Revisar
        </Button>
        <Button variant="soft" size="sm">
          Dárselos
        </Button>
        <Button variant="dark" size="lg" pill>
          Comentar
        </Button>
        <Button variant="primary" disabled>
          Desactivado
        </Button>
      </Row>
      <Row label="Solo icono">
        <IconButton label="Subir">
          <ArrowUpIcon size={17} />
        </IconButton>
        <IconButton label="Bajar">
          <ArrowDownIcon size={17} />
        </IconButton>
        <IconButton label="Mes anterior" tone="filled" size="md">
          <ArrowUpIcon size={16} className="-rotate-90" />
        </IconButton>
        <IconButton label="Guardar" tone="floating" size="md">
          <BookmarkIcon size={17} />
        </IconButton>
      </Row>
    </Section>
  );
}

function Badges() {
  return (
    <Section id="badges" title="Etiquetas">
      <Row label="Procedencia">
        <ProvenanceBadge trust="verified" />
        <ProvenanceBadge trust="verified" label="long" size="md" withIcon />
        <ProvenanceBadge trust="unverified" />
        <ProvenanceBadge trust="unverified" size="md" withIcon />
        <ProvenanceBadge trust="stale" label="Verificado hace 5 días" size="md" withIcon />
      </Row>
      <Row label="Tonos">
        <Badge tone="accent">Tu 1.ª opción</Badge>
        <Badge tone="accent-solid">Aprobada</Badge>
        <Badge tone="muted">Sin tus puntos</Badge>
        <Badge tone="neutral">Borrador</Badge>
        <Badge tone="white" size="md">
          Ciudad
        </Badge>
        <Badge tone="dark">Cerrada</Badge>
      </Row>
      <Row label="Personas">
        {(["accent", "sand", "lilac", "mint", "sky", "rose", "white"] as AvatarTint[]).map((t, i) => (
          <Avatar key={t} initials={["EP", "MG", "IV", "RB", "LC", "DS", "??"][i]!} tint={t} size="lg" />
        ))}
        <Avatar initials="EP" tint="accent" size="xs" />
        <Avatar initials="EP" tint="accent" size="sm" />
        <Avatar initials="EP" tint="accent" size="xl" name="Eyman" />
      </Row>
    </Section>
  );
}

function Chips() {
  const [nights, setNights] = useState(7);
  const [flex, setFlex] = useState(0);
  const [filter, setFilter] = useState("all");
  const [stops, setStops] = useState("direct");
  const [extras, setExtras] = useState({ stays: true, things: false });
  const [nav, setNav] = useState("generar");
  const [cat, setCat] = useState("all");
  return (
    <Section id="chips" title="Chips">
      <Row label="outline · duración">
        {[3, 5, 7, 10].map((n) => (
          <Chip key={n} on={nights === n} onClick={() => setNights(n)}>
            {n} noches
          </Chip>
        ))}
      </Row>
      <Row label="subtle · flexibilidad">
        {["Fechas exactas", "± 1 día", "± 2 días"].map((l, i) => (
          <Chip key={l} variant="subtle" size="sm" on={flex === i} onClick={() => setFlex(i)}>
            {l}
          </Chip>
        ))}
      </Row>
      <Row label="solid · filtros de Revisar">
        {[
          ["all", "Todas · 12"],
          ["pending", "Por revisar · 6"],
          ["approved", "Aprobadas · 4"],
        ].map(([id, l]) => (
          <Chip key={id} variant="solid" size="lg" on={filter === id} onClick={() => setFilter(id!)}>
            {l}
          </Chip>
        ))}
      </Row>
      <Row label="nav · navegación del panel">
        {["generar", "revisar", "comparativa"].map((id) => (
          <Chip key={id} variant="nav" on={nav === id} onClick={() => setNav(id)}>
            {id[0]!.toUpperCase() + id.slice(1)}
          </Chip>
        ))}
      </Row>
      <Row label="ChoiceChip · radios y casillas reales">
        {[
          ["direct", "Directo"],
          ["one", "1 escala"],
          ["any", "Indiferente"],
        ].map(([v, l]) => (
          <ChoiceChip key={v} type="radio" name="g-stops" label={l} checked={stops === v} onChange={() => setStops(v!)} />
        ))}
        <ChoiceChip type="checkbox" label="Estimar alojamiento" checked={extras.stays} onChange={(e) => setExtras({ ...extras, stays: e.target.checked })} />
        <ChoiceChip type="checkbox" label="Qué hacer y ver" checked={extras.things} onChange={(e) => setExtras({ ...extras, things: e.target.checked })} />
      </Row>
      <Row label="IconTabs · categorías">
        <IconTabs
          label="Categoría"
          value={cat}
          onChange={setCat}
          tabs={[
            { id: "all", label: "Todos", icon: <GlobeIcon size={22} /> },
            { id: "ciudad", label: "Ciudad", icon: <CityIcon size={22} /> },
            { id: "escapada", label: "Escapada", icon: <HouseIcon size={22} /> },
            { id: "playa", label: "Playa", icon: <BeachIcon size={22} /> },
            { id: "naturaleza", label: "Naturaleza", icon: <MountainIcon size={22} /> },
          ]}
        />
      </Row>
    </Section>
  );
}

function Forms() {
  const [dest, setDest] = useState("any");
  const [provider, setProvider] = useState("duffel");
  const [people, setPeople] = useState(6);
  const [price, setPrice] = useState(420);
  const [source, setSource] = useState("api");
  const [hide, setHide] = useState(true);
  const [inVote, setInVote] = useState(true);
  return (
    <Section id="forms" title="Formularios">
      <div className="grid gap-6 md:grid-cols-2">
        <Field label="Origen">{({ inputId }) => <TextInput id={inputId} defaultValue="Madrid · MAD" />}</Field>
        <Field label="Destino">
          {({ inputId, labelId }) => (
            <Select
              id={inputId}
              labelledBy={labelId}
              value={dest}
              onChange={setDest}
              options={[
                { value: "any", label: "Cualquiera" },
                { value: "europe", label: "Solo Europa" },
                { value: "place", label: "Destino concreto…" },
              ]}
            />
          )}
        </Field>
        <Field label="Personas">
          {() => <Stepper value={people} onChange={setPeople} unit="viajamos" decrementLabel="Quitar una persona" incrementLabel="Añadir una persona" />}
        </Field>
        <Field label="Tope por persona" aside={`${price} €`}>
          {({ inputId }) => <Range id={inputId} min={80} max={900} step={10} value={price} onChange={(e) => setPrice(Number(e.target.value))} />}
        </Field>
        <Fieldset legend="Fuente de datos" variant="muted">
          <div className="flex gap-2">
            <RadioCard name="g-source" title="API de vuelos" description="Precios reales" checked={source === "api"} onChange={() => setSource("api")} />
            <RadioCard name="g-source" title="Claude" description="Con fuentes a verificar" checked={source === "claude"} onChange={() => setSource("claude")} />
          </div>
          <Select
            label="Proveedor de datos de vuelos"
            size="sm"
            placement="above"
            value={provider}
            onChange={setProvider}
            options={[
              { value: "duffel", label: "Duffel" },
              { value: "amadeus", label: "Amadeus · Self-Service" },
              { value: "kiwi", label: "Kiwi · Tequila" },
            ]}
          />
        </Fieldset>
        <div className="flex flex-col gap-4">
          <Checkbox label="Ocultar las que no estén verificadas" checked={hide} onChange={(e) => setHide(e.target.checked)} />
          <Checkbox variant="box" label="Entra en la votación" checked={inVote} onChange={(e) => setInVote(e.target.checked)} />
          <Field label="Comentario">{({ inputId }) => <TextArea id={inputId} placeholder="Escribe un comentario…" />}</Field>
        </div>
      </div>
    </Section>
  );
}

function CalendarSection() {
  const [month, setMonth] = useState({ year: 2026, month0: 10 });
  const [start, setStart] = useState("2026-11-07");
  return (
    <Section id="calendar" title="Calendario">
      <Card variant="outline" radius="tile" padding="sm" className="max-w-[440px]">
        <Calendar {...month} onMonthChange={setMonth} start={start} end={addDays(start, 7)} onPick={setStart} />
      </Card>
    </Section>
  );
}

function Cards() {
  return (
    <Section id="cards" title="Tarjetas">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(["raised", "flat", "outline", "muted", "accent", "dashed"] as const).map((v) => (
          <Card key={v} variant={v}>
            <Heading size="card">{v}</Heading>
            <Text size="sm" tone={v === "accent" ? "accent" : "muted"}>
              Card variant="{v}"
            </Text>
          </Card>
        ))}
        <Card selected>
          <Heading size="card">selected</Heading>
          <Text size="sm" tone="muted">
            Anillo de acento: lo aprobado o elegido.
          </Text>
        </Card>
      </div>
    </Section>
  );
}

function DataSection() {
  return (
    <Section id="data" title="Datos">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Vuelo" value="Directo · 2 h 40 m" />
        <StatTile label="Alojamiento" value="41 € por noche" />
        <StatTile label="Noviembre" value="18 °C · alguna lluvia" />
        <StatTile label="Datos de vuelo" value="Verificados con la API" tone="accent" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <DataList>
            <DataRow label="Vuelo i/v" value="174 €" />
            <DataRow label="7 noches" value="238 €" />
            <DataRow variant="highlight" label="Total / persona" value="412 €" />
            <DataRow label="Trayecto" value="Directo · 1 h 20 m" />
          </DataList>
        </Card>
        <Card>
          <ProsCons pros={["El vuelo más corto de los cuatro", "Piso entero para 6 en Alfama"]} cons={["Media cuadrilla ya ha estado"]} />
        </Card>
        <Card>
          <BulletList
            label="Qué hacer"
            items={[
              { title: "Subir al cráter del Vesubio", detail: "10 € la entrada y una hora de subida" },
              { title: "Pizza en Da Michele o Sorbillo" },
            ]}
          />
        </Card>
      </div>
    </Section>
  );
}

function MediaSection() {
  return (
    <Section id="media" title="Fotos">
      <Text size="sm" tone="muted">
        Hasta que elijamos fotos (Unsplash, Pexels, Wikimedia), cada hueco lleva su etiqueta.
      </Text>
      <div className="grid gap-4 sm:grid-cols-3">
        <Photo label="Foto de Lisboa" className="h-52 rounded-2xl" top={<><ProvenanceBadge trust="verified" size="md" /><IconButton label="Guardar" tone="floating" size="md"><BookmarkIcon size={17} /></IconButton></>} />
        <Photo label="Pompeya" labelPosition="center" className="h-52 rounded-xl" />
        <Photo label="El piso" className="h-52 rounded-xl" bottom={<Button size="sm" className="shadow-chip">Ver las 12 fotos</Button>} />
      </div>
      <Row label="IataTile">
        <IataTile code="LIS" size="lg" />
        <IataTile code="NAP" />
        <IataTile code="RAK" size="sm" />
      </Row>
    </Section>
  );
}

function FeedbackSection() {
  const toast = useToast();
  return (
    <Section id="feedback" title="Avisos">
      <Notice>Precio y horarios salen de búsquedas web, no de la API. Contrástalos antes de publicar.</Notice>
      <Notice tone="accent">Las 4 aprobadas están publicadas en el sitio.</Notice>
      <Notice tone="neutral" icon={<LockIcon size={17} />}>
        Los puntos no se ven hasta que voten los seis.
      </Notice>
      <Row label="Estado">
        <StatusDot>claude bin sin conectar</StatusDot>
        <StatusDot tone="on">claude conectado</StatusDot>
        <StatusDot tone="busy">Consultando vuelos…</StatusDot>
      </Row>
      <Row label="Carga">
        <div className="flex w-80 flex-col gap-2.5">
          <Skeleton className="h-[13px] w-[190px]" />
          <Skeleton className="h-[11px] w-full" />
        </div>
      </Row>
      <Row label="Toast">
        <Button onClick={() => toast("Toque enviado a Laura y Diego")}>Mostrar aviso</Button>
      </Row>
      <EmptyState title="No hay propuestas por revisar" action={<Button variant="primary">Generar más</Button>}>
        Todo lo generado está aprobado o descartado.
      </EmptyState>
      <Row label="Iconos">
        {[CheckIcon, AlertIcon, LockIcon, SearchIcon, FiltersIcon, BookmarkIcon, GlobeIcon, CityIcon, HouseIcon, BeachIcon, MountainIcon].map((I, i) => (
          <I key={i} size={20} />
        ))}
      </Row>
    </Section>
  );
}

function LayoutSection() {
  return (
    <Section id="layout" title="Estructura">
      <div className="overflow-hidden rounded-2xl border border-line-soft">
        <TopBar
          className="static"
          brand={<Brand sub="Panel local" />}
          nav={
            <nav className="hidden gap-1.5 md:flex">
              <a className={chipClasses("nav", true)} href="#layout">Generar</a>
              <a className={chipClasses("nav", false)} href="#layout">Revisar</a>
            </nav>
          }
          end={<StatusDot>claude bin sin conectar</StatusDot>}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-line-soft">
        <TopBar
          variant="site"
          className="static"
          brand={<Brand sub="Grupo 51" size="lg" />}
          center={<InfoPill items={["Noviembre 2026", "7 – 14 nov", "6 personas"]} />}
          nav={
            <nav className="hidden gap-6 md:flex">
              <a className={navLinkClasses(true)} href="#layout">Destinos</a>
              <a className={navLinkClasses(false)} href="#layout">Votación</a>
            </nav>
          }
          end={<Avatar initials="EP" tint="accent" size="lg" />}
        />
      </div>
      <PageHeader title="Noviembre 2026" subtitle="12 propuestas generadas · 4 aprobadas" actions={<Button variant="primary">Publicar 4 aprobadas</Button>} />
    </Section>
  );
}
