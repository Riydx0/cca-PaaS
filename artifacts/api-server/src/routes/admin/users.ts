import { Router } from "express";
import { requireAdmin, requireSuperAdmin } from "../../middlewares/requireRole";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable, serverOrdersTable } from "@workspace/db/schema";
import { eq, ilike, or, desc, count, sql } from "drizzle-orm";
import { AuditService } from "../../services/audit_service";
import { EmailService } from "../../services/email_service";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const search = (req.query.search as string) ?? "";
    const limit = Math.min(parseInt((req.query.limit as string) ?? "50") || 50, 100);
    const offset = parseInt((req.query.offset as string) ?? "0") || 0;

    let rows;
    if (search) {
      rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          status: usersTable.status,
          lastLoginAt: usersTable.lastLoginAt,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(or(ilike(usersTable.email, `%${search}%`), ilike(usersTable.name, `%${search}%`)))
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      rows = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          name: usersTable.name,
          role: usersTable.role,
          status: usersTable.status,
          lastLoginAt: usersTable.lastLoginAt,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const [countRow] = await db.select({ count: count() }).from(usersTable);

    const users = rows.map((u) => ({
      id: String(u.id),
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status ?? "active",
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    }));

    res.json({ users, totalCount: Number(countRow?.count ?? 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.get("/:userId", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        status: usersTable.status,
        lastLoginAt: usersTable.lastLoginAt,
        adminNotes: usersTable.adminNotes,
        createdAt: usersTable.createdAt,
        hasPassword: sql<boolean>`(${usersTable.passwordHash} IS NOT NULL)`,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [orderCountRow] = await db
      .select({ count: count() })
      .from(serverOrdersTable)
      .where(eq(serverOrdersTable.userId, String(userId)));

    const [pendingToken] = await db
      .select({ id: passwordResetTokensTable.id, type: passwordResetTokensTable.type, expiresAt: passwordResetTokensTable.expiresAt })
      .from(passwordResetTokensTable)
      .where(
        eq(passwordResetTokensTable.userId, userId)
      )
      .orderBy(desc(passwordResetTokensTable.createdAt))
      .limit(1);

    const hasPendingLink =
      pendingToken && !pendingToken.expiresAt || (pendingToken && pendingToken.expiresAt > new Date())
        ? true
        : false;

    res.json({
      id: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status ?? "active",
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      adminNotes: user.adminNotes ?? "",
      createdAt: user.createdAt.toISOString(),
      hasPassword: user.hasPassword,
      orderCount: Number(orderCountRow?.count ?? 0),
      hasPendingLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.patch("/:userId/role", requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { role } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const validRoles = ["user", "admin", "super_admin"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be user, admin, or super_admin" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      details: { newRole: role },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, userId, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

router.patch("/:userId/status", requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { status } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const validStatuses = ["active", "suspended", "pending", "disabled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ status })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "user.status_change",
      entityType: "user",
      entityId: userId,
      details: { newStatus: status },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, userId, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

router.patch("/:userId/notes", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { notes } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  if (typeof notes !== "string") {
    res.status(400).json({ error: "notes must be a string" });
    return;
  }

  try {
    const [updated] = await db
      .update(usersTable)
      .set({ adminNotes: notes.trim() || null })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "user.notes_updated",
      entityType: "user",
      entityId: userId,
      details: {},
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notes" });
  }
});

router.post("/:userId/send-password-link", requireSuperAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        passwordHash: usersTable.passwordHash,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const type = user.passwordHash ? "reset" : "setup";

    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResetTokensTable).values({
      userId,
      tokenHash,
      type,
      expiresAt,
      createdById: (req as any).currentUser?.id ?? null,
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    const link = `${appUrl}/set-password?token=${plainToken}&type=${type}`;

    const emailResult = await EmailService.sendPasswordLink({
      to: user.email,
      toName: user.name,
      type: type as "setup" | "reset",
      link,
    });

    AuditService.logEvent({
      userId: (req as any).currentUser?.id,
      action: "admin.password_link_sent",
      entityType: "user",
      entityId: userId,
      details: { type, targetEmail: user.email },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({
      success: true,
      type,
      sent: emailResult.sent,
      plainLink: emailResult.plainLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send password link" });
  }
});

export default router;
