import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable } from "@workspace/db/schema";
import { eq, count, and, gt, isNull, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AuditService } from "../services/audit_service";

const router = Router();

router.get("/auth/me", async (req: any, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.id, userId));

    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/register", async (req: any, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "Name, email and password are required" });
    return;
  }
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters" });
    return;
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const [countRow] = await db.select({ count: count() }).from(usersTable);
    const isFirstUser = Number(countRow?.count ?? 0) === 0;
    const role = isFirstUser ? "super_admin" : "user";

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        name: name.trim(),
        passwordHash,
        role,
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
      });

    req.session.userId = user.id;
    req.session.userRole = user.role;

    req.session.save((err: Error | null) => {
      if (err) {
        res.status(500).json({ error: "Registration failed. Please try again." });
        return;
      }
      res.status(201).json(user);
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
    } else {
      res.status(500).json({ error: "Registration failed. Please try again." });
    }
  }
});

router.post("/auth/login", async (req: any, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "Password not set. Please use the setup link sent by your admin." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Your account has been suspended. Please contact your administrator." });
      return;
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    db.update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .execute()
      .catch(() => {});

    req.session.save((err: Error | null) => {
      if (err) {
        res.status(500).json({ error: "Login failed. Please try again." });
        return;
      }

      AuditService.logEvent({
        userId: user.id,
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        details: { email: user.email },
        ipAddress: req.ip,
      }).catch(() => {});

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    });
  } catch {
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/auth/logout", (req: any, res) => {
  req.session.destroy(() => {
    res.clearCookie("ccapaas.sid");
    res.json({ success: true });
  });
});

router.post("/auth/forgot-password", async (_req, res) => {
  res.json({
    success: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  });
});

router.get("/auth/validate-token", async (req, res) => {
  const { token, type } = req.query as { token?: string; type?: string };

  if (!token || !type) {
    res.status(400).json({ error: "token and type are required" });
    return;
  }
  if (!["setup", "reset"].includes(type)) {
    res.status(400).json({ error: "type must be setup or reset" });
    return;
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    const [record] = await db
      .select({
        id: passwordResetTokensTable.id,
        userId: passwordResetTokensTable.userId,
        type: passwordResetTokensTable.type,
        expiresAt: passwordResetTokensTable.expiresAt,
        usedAt: passwordResetTokensTable.usedAt,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(passwordResetTokensTable)
      .innerJoin(usersTable, eq(passwordResetTokensTable.userId, usersTable.id))
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          eq(passwordResetTokensTable.type, type)
        )
      )
      .limit(1);

    if (!record) {
      res.status(404).json({ error: "Invalid or expired token" });
      return;
    }
    if (record.usedAt) {
      res.status(410).json({ error: "This link has already been used" });
      return;
    }
    if (record.expiresAt < now) {
      res.status(410).json({ error: "This link has expired. Please ask your admin to send a new one." });
      return;
    }

    res.json({
      valid: true,
      type: record.type,
      userName: record.userName,
      userEmail: record.userEmail,
    });
  } catch {
    res.status(500).json({ error: "Failed to validate token" });
  }
});

router.post("/auth/set-password", async (req, res) => {
  const { token, type, password } = req.body;

  if (!token || !type || !password) {
    res.status(400).json({ error: "token, type, and password are required" });
    return;
  }
  if (!["setup", "reset"].includes(type)) {
    res.status(400).json({ error: "type must be setup or reset" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const now = new Date();

    // First verify the token exists at all (for better error messages)
    const [tokenRecord] = await db
      .select({ id: passwordResetTokensTable.id, usedAt: passwordResetTokensTable.usedAt, expiresAt: passwordResetTokensTable.expiresAt, userId: passwordResetTokensTable.userId })
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          eq(passwordResetTokensTable.type, type)
        )
      )
      .limit(1);

    if (!tokenRecord) {
      res.status(404).json({ error: "Invalid or expired token" });
      return;
    }
    if (tokenRecord.usedAt) {
      res.status(410).json({ error: "This link has already been used" });
      return;
    }
    if (tokenRecord.expiresAt < now) {
      res.status(410).json({ error: "This link has expired. Please ask your admin to send a new one." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Atomically consume token: only mark used if it hasn't been used yet and isn't expired.
    // This prevents race conditions where two concurrent requests could both pass the checks above.
    const [consumed] = await db
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokensTable.id, tokenRecord.id),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, now)
        )
      )
      .returning({ id: passwordResetTokensTable.id });

    if (!consumed) {
      // Another concurrent request consumed the token first
      res.status(410).json({ error: "This link has already been used" });
      return;
    }

    await db
      .update(usersTable)
      .set({ passwordHash, status: "active" })
      .where(eq(usersTable.id, tokenRecord.userId));

    AuditService.logEvent({
      userId: tokenRecord.userId,
      action: type === "setup" ? "auth.password_setup" : "auth.password_reset",
      entityType: "user",
      entityId: tokenRecord.userId,
      details: { type },
    }).catch(() => {});

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to set password. Please try again." });
  }
});

export default router;
