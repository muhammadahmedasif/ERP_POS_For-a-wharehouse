import { createRequire } from "module";

const requireServer = createRequire(import.meta.url);

export default async function handler(req: any, res: any) {
  try {
    const { app } = requireServer("../dist/server.cjs");
    return app(req, res);
  } catch (error: any) {
    console.error("API handler crashed:", error);
    return res.status(500).json({
      error: "API handler crashed",
      message: error?.message || "Unknown server error",
    });
  }
}
