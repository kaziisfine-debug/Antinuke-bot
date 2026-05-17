import {
  pgTable, text, integer, boolean, bigint,
  timestamp, serial, jsonb, uniqueIndex, primaryKey
} from "drizzle-orm/pg-core";

export const guildSettings = pgTable("guild_settings", {
  guildId: text("guild_id").primaryKey(),
  antiNukeEnabled: boolean("anti_nuke_enabled").default(true).notNull(),
  verificationEnabled: boolean("verification_enabled").default(false).notNull(),
  verificationChannelId: text("verification_channel_id"),
  verificationRoleId: text("verification_role_id"),
  welcomeEnabled: boolean("welcome_enabled").default(false).notNull(),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  goodbyeEnabled: boolean("goodbye_enabled").default(false).notNull(),
  goodbyeChannelId: text("goodbye_channel_id"),
  goodbyeMessage: text("goodbye_message"),
  logChannelId: text("log_channel_id"),
  antiRaidEnabled: boolean("anti_raid_enabled").default(false).notNull(),
  antiRaidLocked: boolean("anti_raid_locked").default(false).notNull(),
  snapshotData: jsonb("snapshot_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const antiNukeConfig = pgTable("anti_nuke_config", {
  guildId: text("guild_id").primaryKey(),
  maxBans: integer("max_bans").default(3).notNull(),
  maxKicks: integer("max_kicks").default(3).notNull(),
  maxChannelDelete: integer("max_channel_delete").default(2).notNull(),
  maxChannelCreate: integer("max_channel_create").default(4).notNull(),
  maxRoleDelete: integer("max_role_delete").default(2).notNull(),
  maxRoleCreate: integer("max_role_create").default(4).notNull(),
  maxWebhookCreate: integer("max_webhook_create").default(3).notNull(),
  maxMentions: integer("max_mentions").default(10).notNull(),
  intervalSeconds: integer("interval_seconds").default(10).notNull(),
  punishAction: text("punish_action").default("ban").notNull(),
  antiRaidThreshold: integer("anti_raid_threshold").default(8).notNull(),
  antiRaidInterval: integer("anti_raid_interval").default(10).notNull(),
});

export const whitelistedUsers = pgTable("whitelisted_users", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("whitelist_unique").on(t.guildId, t.userId)]);

export const extraOwners = pgTable("extra_owners", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("extra_owner_unique").on(t.guildId, t.userId)]);

export const unbypssableRoles = pgTable("unbypssable_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("unbypssable_unique").on(t.guildId, t.userId)]);

export const autoRoles = pgTable("auto_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  roleId: text("role_id").notNull(),
}, (t) => [uniqueIndex("auto_role_unique").on(t.guildId, t.roleId)]);

export const ticketPanels = pgTable("ticket_panels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  categoryId: text("category_id"),
  supportRoleId: text("support_role_id"),
  embedTitle: text("embed_title").default("Support Tickets").notNull(),
  embedDescription: text("embed_description").default("Click the button below to open a ticket.").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  userId: text("user_id").notNull(),
  ticketNumber: integer("ticket_number").notNull(),
  status: text("status").default("open").notNull(),
  claimedBy: text("claimed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const logConfig = pgTable("log_config", {
  guildId: text("guild_id").primaryKey(),
  logChannelId: text("log_channel_id"),
  messageDelete: boolean("message_delete").default(true).notNull(),
  messageEdit: boolean("message_edit").default(true).notNull(),
  memberJoin: boolean("member_join").default(true).notNull(),
  memberLeave: boolean("member_leave").default(true).notNull(),
  memberBan: boolean("member_ban").default(true).notNull(),
  memberUnban: boolean("member_unban").default(true).notNull(),
  roleCreate: boolean("role_create").default(true).notNull(),
  roleDelete: boolean("role_delete").default(true).notNull(),
  channelCreate: boolean("channel_create").default(true).notNull(),
  channelDelete: boolean("channel_delete").default(true).notNull(),
  nicknameChange: boolean("nickname_change").default(false).notNull(),
});

export const giveaways = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  hostId: text("host_id").notNull(),
  prize: text("prize").notNull(),
  winnersCount: integer("winners_count").default(1).notNull(),
  endsAt: timestamp("ends_at").notNull(),
  ended: boolean("ended").default(false).notNull(),
  winnerIds: jsonb("winner_ids").default([]).notNull(),
  requirements: text("requirements"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giveawayEntries = pgTable("giveaway_entries", {
  giveawayId: integer("giveaway_id").references(() => giveaways.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
}, (t) => [primaryKey({ columns: [t.giveawayId, t.userId] })]);

export const userLevels = pgTable("user_levels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(0).notNull(),
  totalXp: integer("total_xp").default(0).notNull(),
  lastMessageAt: timestamp("last_message_at"),
}, (t) => [uniqueIndex("user_level_unique").on(t.guildId, t.userId)]);

export const levelRoles = pgTable("level_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  level: integer("level").notNull(),
  roleId: text("role_id").notNull(),
}, (t) => [uniqueIndex("level_role_unique").on(t.guildId, t.level)]);

export const userEconomy = pgTable("user_economy", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  wallet: bigint("wallet", { mode: "number" }).default(0).notNull(),
  bank: bigint("bank", { mode: "number" }).default(0).notNull(),
  lastDaily: timestamp("last_daily"),
  lastWork: timestamp("last_work"),
}, (t) => [uniqueIndex("user_economy_unique").on(t.guildId, t.userId)]);

export const reactionRoles = pgTable("reaction_roles", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  channelId: text("channel_id").notNull(),
  messageId: text("message_id").notNull(),
  emoji: text("emoji").notNull(),
  roleId: text("role_id").notNull(),
  mode: text("mode").default("toggle").notNull(),
}, (t) => [uniqueIndex("reaction_role_unique").on(t.messageId, t.emoji)]);

export const customCommands = pgTable("custom_commands", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  trigger: text("trigger").notNull(),
  response: text("response").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("custom_cmd_unique").on(t.guildId, t.trigger)]);

export const pendingVerifications = pgTable("pending_verifications", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").default(0).notNull(),
}, (t) => [uniqueIndex("pending_verify_unique").on(t.guildId, t.userId)]);
