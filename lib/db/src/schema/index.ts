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
  // 0 = zero tolerance (ban on first action), N = allow N actions before ban
  maxBans: integer("max_bans").default(0).notNull(),
  maxKicks: integer("max_kicks").default(0).notNull(),
  maxChannelDelete: integer("max_channel_delete").default(0).notNull(),
  maxChannelCreate: integer("max_channel_create").default(0).notNull(),
  maxRoleDelete: integer("max_role_delete").default(0).notNull(),
  maxRoleCreate: integer("max_role_create").default(0).notNull(),
  maxWebhookCreate: integer("max_webhook_create").default(0).notNull(),
  maxMentions: integer("max_mentions").default(0).notNull(),
  intervalSeconds: integer("interval_seconds").default(10).notNull(),
  punishAction: text("punish_action").default("ban").notNull(),
  antiRaidThreshold: integer("anti_raid_threshold").default(8).notNull(),
  antiRaidInterval: integer("anti_raid_interval").default(10).notNull(),
  // Per-module enables — all true = full protection
  antiBan: boolean("anti_ban").default(true).notNull(),
  antiKick: boolean("anti_kick").default(true).notNull(),
  antiPrune: boolean("anti_prune").default(true).notNull(),
  antiBotAdd: boolean("anti_bot_add").default(true).notNull(),
  antiServerUpdate: boolean("anti_server_update").default(true).notNull(),
  antiMemberRoleUpdate: boolean("anti_member_role_update").default(true).notNull(),
  antiChannelCreate: boolean("anti_channel_create").default(true).notNull(),
  antiChannelDelete: boolean("anti_channel_delete").default(true).notNull(),
  antiChannelUpdate: boolean("anti_channel_update").default(true).notNull(),
  antiRoleCreate: boolean("anti_role_create").default(true).notNull(),
  antiRoleDelete: boolean("anti_role_delete").default(true).notNull(),
  antiRoleUpdate: boolean("anti_role_update").default(true).notNull(),
  antiMentionEveryone: boolean("anti_mention_everyone").default(true).notNull(),
  antiWebhookCreate: boolean("anti_webhook_create").default(true).notNull(),
  antiWebhookDelete: boolean("anti_webhook_delete").default(true).notNull(),
  antiEmojiCreate: boolean("anti_emoji_create").default(true).notNull(),
  antiEmojiDelete: boolean("anti_emoji_delete").default(true).notNull(),
  antiStickerCreate: boolean("anti_sticker_create").default(true).notNull(),
  antiStickerDelete: boolean("anti_sticker_delete").default(true).notNull(),
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
  // ── Messages ──
  messageDelete: boolean("message_delete").default(true).notNull(),
  messageEdit: boolean("message_edit").default(true).notNull(),
  // ── Members ──
  memberJoin: boolean("member_join").default(true).notNull(),
  memberLeave: boolean("member_leave").default(true).notNull(),
  memberBan: boolean("member_ban").default(true).notNull(),
  memberUnban: boolean("member_unban").default(true).notNull(),
  memberKick: boolean("member_kick").default(true).notNull(),
  memberTimeout: boolean("member_timeout").default(true).notNull(),
  memberRoleChange: boolean("member_role_change").default(true).notNull(),
  nicknameChange: boolean("nickname_change").default(true).notNull(),
  // ── Voice ──
  voiceJoin: boolean("voice_join").default(true).notNull(),
  voiceLeave: boolean("voice_leave").default(true).notNull(),
  voiceMove: boolean("voice_move").default(true).notNull(),
  // ── Roles ──
  roleCreate: boolean("role_create").default(true).notNull(),
  roleDelete: boolean("role_delete").default(true).notNull(),
  roleUpdate: boolean("role_update").default(true).notNull(),
  // ── Channels ──
  channelCreate: boolean("channel_create").default(true).notNull(),
  channelDelete: boolean("channel_delete").default(true).notNull(),
  channelUpdate: boolean("channel_update").default(true).notNull(),
  // ── Server ──
  serverUpdate: boolean("server_update").default(true).notNull(),
  // ── Invites & Threads ──
  inviteCreate: boolean("invite_create").default(true).notNull(),
  inviteDelete: boolean("invite_delete").default(true).notNull(),
  threadCreate: boolean("thread_create").default(true).notNull(),
  // ── Emoji / Sticker ──
  emojiUpdate: boolean("emoji_update").default(true).notNull(),
  // ── Security ──
  antinukeAction: boolean("antinuke_action").default(true).notNull(),
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
