import { Guild, GuildMember, TextChannel, EmbedBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { getAntiNukeConfig, getGuildSettings, updateGuildSettings } from "../database.js";
import { COLORS } from "../config.js";
import { logger } from "../../lib/logger.js";

const joinTracker = new Map<string, number[]>();

export async function trackJoin(guild: Guild, member: GuildMember): Promise<boolean> {
  const settings = await getGuildSettings(guild.id);
  if (!settings.antiRaidEnabled) return false;

  const cfg = await getAntiNukeConfig(guild.id);
  const key = guild.id;
  const now = Date.now();
  const windowMs = cfg.antiRaidInterval * 1000;

  if (!joinTracker.has(key)) joinTracker.set(key, []);
  const joins = joinTracker.get(key)!;
  const filtered = joins.filter(t => now - t < windowMs);
  filtered.push(now);
  joinTracker.set(key, filtered);

  if (filtered.length >= cfg.antiRaidThreshold && !settings.antiRaidLocked) {
    await activateLockdown(guild);
    return true;
  }
  return false;
}

export async function activateLockdown(guild: Guild): Promise<void> {
  try {
    await updateGuildSettings(guild.id, { antiRaidLocked: true });
    logger.info({ guildId: guild.id }, "Anti-raid lockdown activated");

    const everyone = guild.roles.everyone;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText) as Map<string, TextChannel>;

    await Promise.allSettled(
      Array.from(textChannels.values()).map(ch =>
        ch.permissionOverwrites.edit(everyone, {
          SendMessages: false,
          AddReactions: false,
        }, { reason: "[ANTINUKE] Anti-Raid Lockdown Activated" })
      )
    );

    const settings = await getGuildSettings(guild.id);
    if (settings.logChannelId) {
      const logCh = guild.channels.cache.get(settings.logChannelId) as TextChannel | undefined;
      if (logCh) {
        await logCh.send({
          embeds: [new EmbedBuilder()
            .setColor(COLORS.red)
            .setTitle("🔒 ANTI-RAID LOCKDOWN ACTIVATED")
            .setDescription("Mass join detected! All text channels have been locked.\nUse `/antiraid unlock` to unlock.")
            .setTimestamp()],
        });
      }
    }
  } catch (err) {
    logger.error({ err, guildId: guild.id }, "Failed to activate lockdown");
  }
}

export async function deactivateLockdown(guild: Guild): Promise<void> {
  try {
    await updateGuildSettings(guild.id, { antiRaidLocked: false });
    joinTracker.delete(guild.id);

    const everyone = guild.roles.everyone;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText) as Map<string, TextChannel>;

    await Promise.allSettled(
      Array.from(textChannels.values()).map(ch =>
        ch.permissionOverwrites.edit(everyone, {
          SendMessages: null,
          AddReactions: null,
        }, { reason: "[ANTINUKE] Anti-Raid Lockdown Deactivated" })
      )
    );

    logger.info({ guildId: guild.id }, "Anti-raid lockdown deactivated");
  } catch (err) {
    logger.error({ err, guildId: guild.id }, "Failed to deactivate lockdown");
  }
}
