export default async function handler(_req: any, res: any) {
  try {
    await import("../server.ts");
    return res.status(200).json({ ok: true, serverImport: true });
  } catch (error: any) {
    console.error("Server import health check failed:", error);
    return res.status(500).json({
      ok: false,
      serverImport: false,
      message: error?.message || "Unknown server import error",
      code: error?.code || null,
    });
  }
}
