import { createRequire } from "module";

const requireServer = createRequire(import.meta.url);

let app: any;
let initError: any;

try {
  const mod = requireServer("../dist/server.cjs");
  app = mod.app;
} catch (error) {
  initError = error;
  console.error("API handler crashed during initialization:", error);
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: any, res: any) {
  if (initError) {
    return res.status(500).json({
      error: "API handler crashed during initialization",
      message: initError?.message || String(initError),
    });
  }
  return app(req, res);
}
