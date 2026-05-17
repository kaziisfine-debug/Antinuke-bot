import {
  Guild, GuildMember, User, PermissionFlagsBits,
  AuditLogEvent, TextChannel, EmbedBuilder, Role,
  GuildChannel,
} from "discord.js";
import { getAntiNukeConfig, isWhitelisted, isExtraOwner, getGuildSettings } from "../database.js";
import { COLORS, UNIVERSAL_OWNER_ID } from "../config.js";
import { logger } from "../../lib/logger.js";

interface ActionEntry {
  timestamps: number[];
}

const actionMap = new Map<string, Map<string, ActionEntry>>();

function getActionKey(guildId: string, userId: string, action: string) {
  return `${guildId}:${userId}:${action}`;
}

function trackAction(guildId: string, userId: string, action: string, intervalMs: number): number {
  const key = getActionKey(guildId, userId, action);
  if (!actionMap.has(guildId)) actionMap.set(guildId, new Map());
  const gMap = actionMap.get(guildId)!;
  if (!gMap.has(key)) gMap.set(key, { timestamps: [] });
  const entry = gMap.get(key)!;
  const now = Date.now();
  entry.timestamps = entry.timestamps.filter(t => now - t < intervalMs);
  entry.timestamps.push(now);
  return entry.timestamps.length;
}

export function clearActions(guildId: string, userId: string) {
  const gMap = actionMap.get(guildId);
  if (!gMap) return;
  for (const key of gMap.keys()) {
    if (key.startsWith(`${guildId}:${userId}:`)) gMap.delete(key);
  }
}

export async function isTrustedUser(guild: Guild, userId: string): Promise<boolean> {
  if (userId === UNIVERSAL_OWNER_ID) return true;
  if (guild.ownerId === userId) return true;
  if (await isExtraOwner(guild.id, userId)) return true;
  if (await isWhitelisted(guild.id, userId)) return true;
  return false;
}

async function punishUser(guild: Guild, userId: string, action: string, punishAction: string, reason: string) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (member.id === guild.ownerId || member.id === UNIVERSAL_OWNER_ID) return;

    logger.info({ guildId: guild.id, userId, action, punishAction }, "Antinuke punishment");

    if (punishAction === "ban") {
      await guild.bans.create(userId, { reason: `[ANTINUKE] ${reason}` });
    } else if (punishAction === "kick") {
      await member.kick(`[ANTINUKE] ${reason}`);
    } else if (punishAction === "strip_roles") {
      const roles = member.roles.cache.filter(r => r.id !== guild.id);
      await member.roles.set([], `[ANTINUKE] ${reason}`);
    } else if (punishAction === "deafen") {
      if (member.voice.channel) await member.voice.setDeaf(true, `[ANTINUKE] ${reason}`);
    }

    clearActions(guild.id, userId);

    const settings = await getGuildSettings(guild.id);
    if (settings.logChannelId) {
      const logCh = guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.antinuke)
            .setTitle("⚡ ANTINUKE TRIGGERED")
            .addFields(
              { name: "Action", value: action, inline: true },
              { name: "Offender", value: `<@${userId}> (${userId})`, inline: true },
              { name: "Punishment", value: punishAction, inline: true },
              { name: "Reason", value: reason },
            )
            .setTimestamp()],
        });
      }
    }
  } catch (err) {
    logger.error({ err, guildId: guild.id, userId }, "Failed to punish antinuke offender");
  }
}

export async function checkAction(
  guild: Guild,
  userId: string,
  action: "ban" | "kick" | "channelDelete" | "channelCreate" | "roleDelete" | "roleCreate" | "webhookCreate" | "mention",
): Promise<boolean> {
  if (await isTrustedUser(guild, userId)) return false;

  const cfg = await getAntiNukeConfig(guild.id);
  const settings = await getGuildSettings(guild.id);
  if (!settings.antiNukeEnabled) return false;

  const limits: Record<string, number> = {
    ban: cfg.maxBans,
    kick: cfg.maxKicks,
    channelDelete: cfg.maxChannelDelete,
    channelCreate: cfg.maxChannelCreate,
    roleDelete: cfg.maxRoleDelete,
    roleCreate: cfg.maxRoleCreate,
    webhookCreate: cfg.maxWebhookCreate,
    mention: cfg.maxMentions,
  };

  const limit = limits[action] ?? 3;
  const intervalMs = cfg.intervalSeconds * 1000;
  const count = trackAction(guild.id, userId, action, intervalMs);

  if (count >= limit) {
    const reasons: Record<string, string> = {
      ban: `Mass ban detected (${count} bans in ${cfg.intervalSeconds}s)`,
      kick: `Mass kick detected (${count} kicks in ${cfg.intervalSeconds}s)`,
      channelDelete: `Mass channel deletion (${count} in ${cfg.intervalSeconds}s)`,
      channelCreate: `Mass channel creation (${count} in ${cfg.intervalSeconds}s)`,
      roleDelete: `Mass role deletion (${count} in ${cfg.intervalSeconds}s)`,
      roleCreate: `Mass role creation (${count} in ${cfg.intervalSeconds}s)`,
      webhookCreate: `Mass webhook creation (${count} in ${cfg.intervalSeconds}s)`,
      mention: `Mass mention spam (${count} mentions)`,
    };
    await punishUser(guild, userId, action, cfg.punishAction, reasons[action] ?? "Suspicious activity");
    return true;
  }
  return false;
}

export async function getAuditLogUser(guild: Guild, event: AuditLogEvent): Promise<string | null> {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: event });
    const entry = logs.entries.first();
    if (!entry) return null;
    if (Date.now() - entry.createdTimestamp > 5000) return null;
    return entry.executor?.id ?? null;
  } catch {
    return null;
  }
}
