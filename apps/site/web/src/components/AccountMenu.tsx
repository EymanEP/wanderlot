import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Avatar, Button } from "@wanderlot/ui";
import type { Person } from "../data/store.tsx";
import { useAuth } from "../data/auth.tsx";

// The avatar in the header: who you are, changing your PIN, and signing this
// device out.
export function AccountMenu({ me }: { me: Person }) {
  const auth = useAuth();
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

  const name = auth.state.status === "in" ? auth.state.member.name : me.name;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Tu cuenta"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((x) => !x)}
        className="cursor-pointer rounded-full border-0 bg-transparent p-0"
      >
        <Avatar initials={me.initials} tint="accent" size="lg" />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-40 flex w-60 flex-col gap-3 rounded-tile bg-surface p-4 shadow-pop">
          <div className="flex flex-col">
            <span className="text-[15px] font-bold">{name}</span>
            <span className="text-[13px] text-muted">Has entrado en este dispositivo</span>
          </div>
          <Button block onClick={() => navigate("/nuevo-pin", { state: { from: location.pathname } })}>
            Cambiar mi PIN
          </Button>
          <Button
            block
            onClick={async () => {
              await auth.signOut();
              navigate("/entrar", { replace: true });
            }}
          >
            Cerrar sesión en este dispositivo
          </Button>
        </div>
      )}
    </div>
  );
}
