import type { ReactNode } from "react";
import { Brand, Card, Page } from "@wanderlot/ui";

// A quiet, centred card for signing in and accepting invites.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Page className="bg-canvas">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <Brand size="lg" sub="Grupo 51" />
        <Card as="main" variant="raised" radius="card" className="flex w-full max-w-[440px] flex-col gap-5 p-7 sm:p-8">
          {children}
        </Card>
      </div>
    </Page>
  );
}
