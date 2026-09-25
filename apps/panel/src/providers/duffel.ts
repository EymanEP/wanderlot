import type { FlightProvider } from "./types.ts";

// Duffel is the default flight source (SPEC §8). Not wired up yet: needs an
// API key and the offer-request → offers mapping onto FlightLeg.
export function duffelProvider(apiKey: string | undefined): FlightProvider {
  const notReady = () => {
    throw new Error(apiKey ? "Duffel: pendiente de implementar" : "Duffel: falta DUFFEL_API_KEY");
  };
  return {
    name: "duffel",
    search: () => notReady(),
    verify: async () => notReady(),
  };
}
