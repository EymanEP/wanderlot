import { Navigate, Route, Routes } from "react-router";
import { ComparativaPage } from "./pages/ComparativaPage.tsx";
import { GenerarPage } from "./pages/GenerarPage.tsx";
import { PersonasPage } from "./pages/PersonasPage.tsx";
import { RevisarPage } from "./pages/RevisarPage.tsx";

export function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/generar" replace />} />
      <Route path="/generar" element={<GenerarPage />} />
      <Route path="/revisar" element={<RevisarPage />} />
      <Route path="/comparativa" element={<ComparativaPage />} />
      <Route path="/personas" element={<PersonasPage />} />
      <Route path="*" element={<Navigate to="/generar" replace />} />
    </Routes>
  );
}
