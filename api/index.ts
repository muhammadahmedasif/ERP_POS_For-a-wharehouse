import { app } from '../server';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (error: any) {
    console.error("API handler crashed:", error);
    return res.status(500).json({
      error: "API handler crashed",
      message: error?.message || "Unknown server error",
    });
  }
}
