// Imported first by main.tsx. The site's CSP forbids eval; tell zod not to
// probe for it (the probe is harmless but is reported as a policy violation).
import { z } from "zod";

z.config({ jitless: true });
