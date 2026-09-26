import { Component, type ReactNode } from "react";
import { useLocation } from "react-router";
import { Button, EmptyState, Main } from "@wanderlot/ui";

interface State {
  error: Error | null;
}

class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Wanderlot: la página falló al mostrarse", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Main>
        <EmptyState
          title="Algo ha fallado al mostrar esta página"
          action={
            <Button variant="primary" onClick={() => window.location.reload()}>
              Recargar
            </Button>
          }
        >
          {this.state.error.message}
        </EmptyState>
      </Main>
    );
  }
}

// A page that throws while rendering shows what failed and a way out instead
// of a blank screen. Moving to another page starts it afresh.
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
