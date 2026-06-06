export default async function handler(req: any, res: any) {
  try {
    const { app } = await import("../server.ts");
    return app(req, res);
  } catch (error: any) {
    console.error("API handler crashed:", error);
    return res.status(500).json({
      error: "API handler crashed",
      message: error?.message || "Unknown server error",
    });
  }
}
