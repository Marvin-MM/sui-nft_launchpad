import express, { type Request, type Response, type NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// ── Prisma ────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// Graceful shutdown
process.on("SIGINT",  async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });

// ── Constants ─────────────────────────────────────────────────────────────────
const ADMIN_API_KEY = process.env.ADMIN_API_KEY ?? "";

// Basic in-memory rate limiter: max 5 feedback submissions per IP per 15 min
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

const VALID_CATEGORIES = ["bug", "feature", "ux", "performance", "general"] as const;
const VALID_STATUSES   = ["new", "in_progress", "resolved", "closed"] as const;
const VALID_PRIORITIES = ["low", "normal", "high", "critical"] as const;

// ── Middleware helpers ────────────────────────────────────────────────────────

/** Verify the ADMIN_API_KEY from the Authorization header. */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_API_KEY) {
    res.status(503).json({ error: "Admin API key not configured on server." });
    return;
  }
  const auth  = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (token !== ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}

/** Simple per-IP rate limiter for public endpoints. */
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  const now   = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many requests — please try again later." });
    return;
  }

  entry.count += 1;
  next();
}

// Periodically clean up stale rate-limit entries (every 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 30 * 60 * 1000);

// ── Validation helper ─────────────────────────────────────────────────────────
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── API Routes ────────────────────────────────────────────────────────────────
function mountApiRoutes(app: express.Application) {

  // ── POST /api/feedback — public, rate-limited ─────────────────────────────
  app.post("/api/feedback", rateLimit, async (req: Request, res: Response) => {
    try {
      const {
        category      = "general",
        message       = "",
        email,
        name,
        isAnonymous   = false,
        walletAddress,
        page,
      } = req.body as Record<string, unknown>;

      // Validate message
      const msg = String(message).trim();
      if (!msg) {
        res.status(400).json({ error: "Message is required." });
        return;
      }
      if (msg.length > 2000) {
        res.status(400).json({ error: "Message must be 2000 characters or fewer." });
        return;
      }

      // Validate category
      const cat = String(category).toLowerCase();
      if (!(VALID_CATEGORIES as readonly string[]).includes(cat)) {
        res.status(400).json({
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
        });
        return;
      }

      // Validate email if provided
      const emailStr = email ? String(email).trim() : undefined;
      if (emailStr && !isValidEmail(emailStr)) {
        res.status(400).json({ error: "Invalid email address." });
        return;
      }

      const feedback = await prisma.feedback.create({
        data: {
          category:      cat,
          message:       msg,
          email:         emailStr || null,
          name:          name          ? String(name).trim().slice(0, 100)          : null,
          isAnonymous:   Boolean(isAnonymous),
          walletAddress: walletAddress ? String(walletAddress).trim().slice(0, 66)  : null,
          page:          page          ? String(page).trim().slice(0, 200)          : null,
        },
        select: { id: true, createdAt: true },
      });

      res.status(201).json({ id: feedback.id, message: "Feedback submitted. Thank you!" });
    } catch (err) {
      console.error("[POST /api/feedback]", err);
      res.status(500).json({ error: "Failed to save feedback." });
    }
  });

  // ── GET /api/feedback — admin only ────────────────────────────────────────
  app.get("/api/feedback", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status   = req.query.status   as string | undefined;
      const category = req.query.category as string | undefined;
      const priority = req.query.priority as string | undefined;
      const search   = req.query.search   as string | undefined;
      const pageNum  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10));
      const limit    = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
      const skip     = (pageNum - 1) * limit;

      const where: Record<string, unknown> = {};
      if (status   && (VALID_STATUSES   as readonly string[]).includes(status))   where.status   = status;
      if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) where.category = category;
      if (priority && (VALID_PRIORITIES as readonly string[]).includes(priority)) where.priority = priority;
      if (search) {
        where.OR = [
          { message:       { contains: search, mode: "insensitive" } },
          { email:         { contains: search, mode: "insensitive" } },
          { name:          { contains: search, mode: "insensitive" } },
          { walletAddress: { contains: search, mode: "insensitive" } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.feedback.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.feedback.count({ where }),
      ]);

      res.json({ data, total, page: pageNum, limit });
    } catch (err) {
      console.error("[GET /api/feedback]", err);
      res.status(500).json({ error: "Failed to retrieve feedback." });
    }
  });

  // ── GET /api/feedback/stats — admin only ─────────────────────────────────
  app.get("/api/feedback/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [byStatus, byCategory, byPriority] = await Promise.all([
        prisma.feedback.groupBy({ by: ["status"],   _count: { _all: true } }),
        prisma.feedback.groupBy({ by: ["category"], _count: { _all: true } }),
        prisma.feedback.groupBy({ by: ["priority"], _count: { _all: true } }),
      ]);

      const total = byStatus.reduce((s, r) => s + r._count._all, 0);

      const toMap = (
        arr: Array<{ _count: { _all: number }; [k: string]: unknown }>,
        key: string,
      ) => Object.fromEntries(arr.map((r) => [r[key] as string, r._count._all]));

      res.json({
        total,
        byStatus:   toMap(byStatus,   "status"),
        byCategory: toMap(byCategory, "category"),
        byPriority: toMap(byPriority, "priority"),
      });
    } catch (err) {
      console.error("[GET /api/feedback/stats]", err);
      res.status(500).json({ error: "Failed to retrieve stats." });
    }
  });

  // ── GET /api/feedback/:id — admin only ───────────────────────────────────
  app.get("/api/feedback/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await prisma.feedback.findUnique({ where: { id: req.params.id } });
      if (!item) { res.status(404).json({ error: "Not found." }); return; }
      res.json(item);
    } catch (err) {
      console.error("[GET /api/feedback/:id]", err);
      res.status(500).json({ error: "Failed to retrieve feedback item." });
    }
  });

  // ── PATCH /api/feedback/:id — admin only ─────────────────────────────────
  app.patch("/api/feedback/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, adminNotes, priority } = req.body as Record<string, unknown>;

      const update: Record<string, unknown> = {};

      if (status !== undefined) {
        if (!(VALID_STATUSES as readonly string[]).includes(String(status))) {
          res.status(400).json({
            error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}.`,
          });
          return;
        }
        update.status = String(status);
      }

      if (priority !== undefined) {
        if (!(VALID_PRIORITIES as readonly string[]).includes(String(priority))) {
          res.status(400).json({
            error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}.`,
          });
          return;
        }
        update.priority = String(priority);
      }

      if (adminNotes !== undefined) {
        update.adminNotes = String(adminNotes).trim().slice(0, 2000) || null;
      }

      if (Object.keys(update).length === 0) {
        res.status(400).json({ error: "No valid fields to update." });
        return;
      }

      const updated = await prisma.feedback.update({
        where: { id: req.params.id },
        data:  update,
      });
      res.json(updated);
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P2025") {
        res.status(404).json({ error: "Not found." });
        return;
      }
      console.error("[PATCH /api/feedback/:id]", err);
      res.status(500).json({ error: "Failed to update feedback." });
    }
  });

  // ── DELETE /api/feedback/:id — admin only ────────────────────────────────
  app.delete("/api/feedback/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await prisma.feedback.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P2025") {
        res.status(404).json({ error: "Not found." });
        return;
      }
      console.error("[DELETE /api/feedback/:id]", err);
      res.status(500).json({ error: "Failed to delete feedback." });
    }
  });
}

// ── Server bootstrap ──────────────────────────────────────────────────────────
async function startServer() {
  const app  = express();
  const PORT = Number(process.env.PORT ?? 3000);

  // Parse JSON with a reasonable size limit
  app.use(express.json({ limit: "16kb" }));

  // Mount API routes BEFORE Vite / static middleware so they take priority
  mountApiRoutes(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback — must come AFTER API routes
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️  DATABASE_URL is not set — feedback API will crash on use.");
    }
    if (!ADMIN_API_KEY) {
      console.warn("⚠️  ADMIN_API_KEY is not set — admin feedback endpoints are disabled.");
    }
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
