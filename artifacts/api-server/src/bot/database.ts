import { db } from "@workspace/db";
import {
  guildSettings, antiNukeConfig, whitelistedUsers, extraOwners,
  unbypssableRoles, autoRoles, logConfig, userLevels, userEconomy,
  reactionRoles, customCommands, pendingVerifications,
  giveaways, giveawayEntries, tickets, ticketPanels, levelRoles,
} from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { UNIVERSAL_OWNER_ID } from "./config.js";

export async function ensureGuild(guildId: string) {
  const existing = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
  if (existing.length === 0) {
    await db.insert(guildSettings).values({ guildId }).onConflictDoNothing();
    await db.insert(antiNukeConfig).values({ guildId }).onConflictDoNothing();
    await db.insert(logConfig).values({ guildId }).onConflictDoNothing();
  }
  return existing[0];
}

export async function getGuildSettings(guildId: string) {
  await ensureGuild(guildId);
  const rows = await db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
  return rows[0]!;
}

export async function updateGuildSettings(guildId: string, values: Partial<typeof guildSettings.$inferInsert>) {
  await ensureGuild(guildId);
  await db.update(guildSettings).set({ ...values, updatedAt: new Date() }).where(eq(guildSettings.guildId, guildId));
}

export async function getAntiNukeConfig(guildId: string) {
  await ensureGuild(guildId);
  const rows = await db.select().from(antiNukeConfig).where(eq(antiNukeConfig.guildId, guildId)).limit(1);
  if (rows.length === 0) {
    await db.insert(antiNukeConfig).values({ guildId }).onConflictDoNothing();
    return (await db.select().from(antiNukeConfig).where(eq(antiNukeConfig.guildId, guildId)).limit(1))[0]!;
  }
  return rows[0]!;
}

export async function updateAntiNukeConfig(guildId: string, values: Partial<typeof antiNukeConfig.$inferInsert>) {
  await db.insert(antiNukeConfig).values({ guildId, ...values }).onConflictDoUpdate({
    target: antiNukeConfig.guildId,
    set: values,
  });
}

export async function isWhitelisted(guildId: string, userId: string): Promise<boolean> {
  if (userId === UNIVERSAL_OWNER_ID) return true;
  const rows = await db.select().from(whitelistedUsers)
    .where(and(eq(whitelistedUsers.guildId, guildId), eq(whitelistedUsers.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function isExtraOwner(guildId: string, userId: string): Promise<boolean> {
  if (userId === UNIVERSAL_OWNER_ID) return true;
  const rows = await db.select().from(extraOwners)
    .where(and(eq(extraOwners.guildId, guildId), eq(extraOwners.userId, userId))).limit(1);
  return rows.length > 0;
}

export async function addWhitelist(guildId: string, userId: string, addedBy: string) {
  await db.insert(whitelistedUsers).values({ guildId, userId, addedBy }).onConflictDoNothing();
}

export async function removeWhitelist(guildId: string, userId: string) {
  await db.delete(whitelistedUsers).where(and(eq(whitelistedUsers.guildId, guildId), eq(whitelistedUsers.userId, userId)));
}

export async function getWhitelist(guildId: string) {
  return db.select().from(whitelistedUsers).where(eq(whitelistedUsers.guildId, guildId));
}

export async function addExtraOwner(guildId: string, userId: string, addedBy: string) {
  await db.insert(extraOwners).values({ guildId, userId, addedBy }).onConflictDoNothing();
}

export async function removeExtraOwner(guildId: string, userId: string) {
  await db.delete(extraOwners).where(and(eq(extraOwners.guildId, guildId), eq(extraOwners.userId, userId)));
}

export async function getExtraOwners(guildId: string) {
  return db.select().from(extraOwners).where(eq(extraOwners.guildId, guildId));
}

export async function getLogConfig(guildId: string) {
  await ensureGuild(guildId);
  const rows = await db.select().from(logConfig).where(eq(logConfig.guildId, guildId)).limit(1);
  if (rows.length === 0) {
    await db.insert(logConfig).values({ guildId }).onConflictDoNothing();
    return (await db.select().from(logConfig).where(eq(logConfig.guildId, guildId)).limit(1))[0]!;
  }
  return rows[0]!;
}

export async function updateLogConfig(guildId: string, values: Partial<typeof logConfig.$inferInsert>) {
  await db.insert(logConfig).values({ guildId, ...values }).onConflictDoUpdate({
    target: logConfig.guildId,
    set: values,
  });
}

export async function getOrCreateUserLevel(guildId: string, userId: string) {
  let rows = await db.select().from(userLevels).where(and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId))).limit(1);
  if (rows.length === 0) {
    await db.insert(userLevels).values({ guildId, userId }).onConflictDoNothing();
    rows = await db.select().from(userLevels).where(and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId))).limit(1);
  }
  return rows[0]!;
}

export async function updateUserLevel(guildId: string, userId: string, values: Partial<typeof userLevels.$inferInsert>) {
  await db.update(userLevels).set(values).where(and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)));
}

export async function getTopLevels(guildId: string, limit = 10) {
  return db.select().from(userLevels).where(eq(userLevels.guildId, guildId))
    .orderBy(sql`${userLevels.totalXp} DESC`).limit(limit);
}

export async function getOrCreateUserEconomy(guildId: string, userId: string) {
  let rows = await db.select().from(userEconomy).where(and(eq(userEconomy.guildId, guildId), eq(userEconomy.userId, userId))).limit(1);
  if (rows.length === 0) {
    await db.insert(userEconomy).values({ guildId, userId }).onConflictDoNothing();
    rows = await db.select().from(userEconomy).where(and(eq(userEconomy.guildId, guildId), eq(userEconomy.userId, userId))).limit(1);
  }
  return rows[0]!;
}

export async function updateUserEconomy(guildId: string, userId: string, values: Partial<typeof userEconomy.$inferInsert>) {
  await db.update(userEconomy).set(values).where(and(eq(userEconomy.guildId, guildId), eq(userEconomy.userId, userId)));
}

export async function getTopEconomy(guildId: string, limit = 10) {
  return db.select().from(userEconomy).where(eq(userEconomy.guildId, guildId))
    .orderBy(sql`${userEconomy.wallet} + ${userEconomy.bank} DESC`).limit(limit);
}

export async function getAutoRoles(guildId: string) {
  return db.select().from(autoRoles).where(eq(autoRoles.guildId, guildId));
}

export async function addAutoRole(guildId: string, roleId: string) {
  await db.insert(autoRoles).values({ guildId, roleId }).onConflictDoNothing();
}

export async function removeAutoRole(guildId: string, roleId: string) {
  await db.delete(autoRoles).where(and(eq(autoRoles.guildId, guildId), eq(autoRoles.roleId, roleId)));
}

export async function getReactionRoles(messageId: string) {
  return db.select().from(reactionRoles).where(eq(reactionRoles.messageId, messageId));
}

export async function getAllReactionRoles(guildId: string) {
  return db.select().from(reactionRoles).where(eq(reactionRoles.guildId, guildId));
}

export async function addReactionRole(guildId: string, channelId: string, messageId: string, emoji: string, roleId: string, mode = "toggle") {
  await db.insert(reactionRoles).values({ guildId, channelId, messageId, emoji, roleId, mode }).onConflictDoNothing();
}

export async function removeReactionRole(messageId: string, emoji: string) {
  await db.delete(reactionRoles).where(and(eq(reactionRoles.messageId, messageId), eq(reactionRoles.emoji, emoji)));
}

export async function getCustomCommands(guildId: string) {
  return db.select().from(customCommands).where(eq(customCommands.guildId, guildId));
}

export async function getCustomCommand(guildId: string, trigger: string) {
  const rows = await db.select().from(customCommands).where(and(eq(customCommands.guildId, guildId), eq(customCommands.trigger, trigger))).limit(1);
  return rows[0] ?? null;
}

export async function addCustomCommand(guildId: string, trigger: string, response: string, createdBy: string) {
  await db.insert(customCommands).values({ guildId, trigger, response, createdBy }).onConflictDoUpdate({
    target: [customCommands.guildId, customCommands.trigger],
    set: { response, createdBy },
  });
}

export async function removeCustomCommand(guildId: string, trigger: string) {
  await db.delete(customCommands).where(and(eq(customCommands.guildId, guildId), eq(customCommands.trigger, trigger)));
}

export async function setPendingVerification(guildId: string, userId: string, code: string, expiresAt: Date) {
  await db.insert(pendingVerifications).values({ guildId, userId, code, expiresAt }).onConflictDoUpdate({
    target: [pendingVerifications.guildId, pendingVerifications.userId],
    set: { code, expiresAt, attempts: 0 },
  });
}

export async function getPendingVerification(guildId: string, userId: string) {
  const rows = await db.select().from(pendingVerifications).where(and(eq(pendingVerifications.guildId, guildId), eq(pendingVerifications.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function incrementVerificationAttempt(guildId: string, userId: string) {
  await db.update(pendingVerifications).set({ attempts: sql`${pendingVerifications.attempts} + 1` })
    .where(and(eq(pendingVerifications.guildId, guildId), eq(pendingVerifications.userId, userId)));
}

export async function deletePendingVerification(guildId: string, userId: string) {
  await db.delete(pendingVerifications).where(and(eq(pendingVerifications.guildId, guildId), eq(pendingVerifications.userId, userId)));
}

export async function createGiveaway(data: typeof giveaways.$inferInsert) {
  const rows = await db.insert(giveaways).values(data).returning();
  return rows[0]!;
}

export async function getGiveaway(id: number) {
  const rows = await db.select().from(giveaways).where(eq(giveaways.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveGiveaways() {
  return db.select().from(giveaways).where(eq(giveaways.ended, false));
}

export async function updateGiveaway(id: number, values: Partial<typeof giveaways.$inferInsert>) {
  await db.update(giveaways).set(values).where(eq(giveaways.id, id));
}

export async function enterGiveaway(giveawayId: number, userId: string) {
  await db.insert(giveawayEntries).values({ giveawayId, userId }).onConflictDoNothing();
}

export async function getGiveawayEntries(giveawayId: number) {
  return db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
}

export async function getTicketPanel(guildId: string) {
  const rows = await db.select().from(ticketPanels).where(eq(ticketPanels.guildId, guildId)).limit(1);
  return rows[0] ?? null;
}

export async function createTicketPanel(data: typeof ticketPanels.$inferInsert) {
  const rows = await db.insert(ticketPanels).values(data).returning();
  return rows[0]!;
}

export async function updateTicketPanel(guildId: string, values: Partial<typeof ticketPanels.$inferInsert>) {
  await db.update(ticketPanels).set(values).where(eq(ticketPanels.guildId, guildId));
}

export async function getNextTicketNumber(guildId: string): Promise<number> {
  const rows = await db.select({ max: sql<number>`coalesce(max(${tickets.ticketNumber}), 0)` }).from(tickets).where(eq(tickets.guildId, guildId));
  return (rows[0]?.max ?? 0) + 1;
}

export async function createTicket(data: typeof tickets.$inferInsert) {
  const rows = await db.insert(tickets).values(data).returning();
  return rows[0]!;
}

export async function getTicketByChannel(channelId: string) {
  const rows = await db.select().from(tickets).where(eq(tickets.channelId, channelId)).limit(1);
  return rows[0] ?? null;
}

export async function updateTicket(channelId: string, values: Partial<typeof tickets.$inferInsert>) {
  await db.update(tickets).set(values).where(eq(tickets.channelId, channelId));
}

export async function getLevelRoles(guildId: string) {
  return db.select().from(levelRoles).where(eq(levelRoles.guildId, guildId)).orderBy(levelRoles.level);
}

export async function addLevelRole(guildId: string, level: number, roleId: string) {
  await db.insert(levelRoles).values({ guildId, level, roleId }).onConflictDoUpdate({
    target: [levelRoles.guildId, levelRoles.level],
    set: { roleId },
  });
}

export async function getUnbypssableRole(guildId: string, userId: string) {
  const rows = await db.select().from(unbypssableRoles).where(and(eq(unbypssableRoles.guildId, guildId), eq(unbypssableRoles.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function setUnbypssableRole(guildId: string, userId: string, roleId: string) {
  await db.insert(unbypssableRoles).values({ guildId, userId, roleId }).onConflictDoUpdate({
    target: [unbypssableRoles.guildId, unbypssableRoles.userId],
    set: { roleId },
  });
}

export async function getAllUnbypssableRoles(guildId: string) {
  return db.select().from(unbypssableRoles).where(eq(unbypssableRoles.guildId, guildId));
}
