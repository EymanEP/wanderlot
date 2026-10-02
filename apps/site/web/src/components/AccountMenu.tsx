import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { LOCALES, LOCALE_NAMES, copy } from "@wanderlot/core";
import { Avatar, GlobeIcon, HouseIcon, KeyIcon, LogOutIcon, cn, useCopy, useLocale } from "@wanderlot/ui";
import type { Person } from "../data/store.tsx";
import { useAuth } from "../data/auth.tsx";

const COPY = copy({
  es: { account: "Tu cuenta", here: "Has entrado en este dispositivo", trips: "Tus viajes", pin: "Cambiar mi PIN", signOut: "Cerrar sesión", language: "Idioma" },
  en: { account: "Your account", here: "Signed in on this device", trips: "Your trips", pin: "Change my PIN", signOut: "Sign out", language: "Language" },
});

// One row of the menu: an icon and a label that wraps rather than spill.
function Item({ icon, onSelect, tone, children }: { icon: ReactNode; onSelect: () => void; tone?: "danger"; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left text-[15px] font-semibold hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
        tone === "danger" ? "text-claude" : "text-ink",
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

// The avatar in the header: who you are, going back to your trips, changing
// your PIN, and signing this device out.
export function AccountMenu({ me }: { me: Person }) {
  const auth = useAuth();
  const t = useCopy(COPY);
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  // Moving to another page closes it.
  useEffect(() => setOpen(false), [location.pathname]);

  const name = auth.state.status === "in" ? auth.state.member.name : me.name;
  const go = (to: string, state?: unknown) => {
    setOpen(false);
    navigate(to, state ? { state } : undefined);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={t.account}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((x) => !x)}
        className="cursor-pointer rounded-full border-0 bg-transparent p-0"
      >
        <Avatar initials={me.initials} tint="accent" size="lg" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t.account}
          className="absolute top-[calc(100%+8px)] right-0 z-40 flex w-[min(280px,calc(100vw-32px))] flex-col rounded-tile border border-line-soft bg-surface p-2 shadow-pop"
        >
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <Avatar initials={me.initials} tint="accent" size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-bold">{name}</span>
              <span className="text-[13px] text-muted">{t.here}</span>
            </div>
          </div>
          <div className="mb-1 border-t border-line-faint" />
          {/* Each language in its own words, so anyone can find theirs. */}
          <div role="group" aria-label={t.language} className="flex items-center gap-3 px-3 py-2">
            <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">
              <GlobeIcon size={18} />
            </span>
            <div className="flex flex-1 gap-1 rounded-full bg-surface-2 p-1">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === l}
                  lang={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-full border-0 px-2.5 py-1.5 text-[13px] font-semibold",
                    locale === l ? "bg-surface text-ink shadow-chip" : "bg-transparent text-muted hover:text-ink",
                  )}
                >
                  {LOCALE_NAMES[l]}
                </button>
              ))}
            </div>
          </div>
          <Item icon={<HouseIcon size={18} />} onSelect={() => go("/")}>
            {t.trips}
          </Item>
          <Item icon={<KeyIcon size={18} />} onSelect={() => go("/nuevo-pin", { from: location.pathname })}>
            {t.pin}
          </Item>
          <Item
            icon={<LogOutIcon size={18} />}
            tone="danger"
            onSelect={async () => {
              setOpen(false);
              await auth.signOut();
              navigate("/entrar", { replace: true });
            }}
          >
            {t.signOut}
          </Item>
        </div>
      )}
    </div>
  );
}
