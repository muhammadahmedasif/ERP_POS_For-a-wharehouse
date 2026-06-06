import { createRequire } from "module";

const requireServer = createRequire(import.meta.url);

let app: any;
let initError: any;

try {
  const mod = requireServer("../dist/server.cjs");
  app = mod.app;
} catch (error) {
  initError = error;
  console.error("Server import health check failed:", error);
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(_req: any, res: any) {
  if (initError) {
    return res.status(500).json({
      ok: false,
      serverImport: false,
      message: initError?.message || "Unknown server import error",
      code: initError?.code || null,
    });
  }
  return res.status(200).json({
    ok: true,
    serverImport: true,
    routesLoaded: typeof app === "function",
  });
}
