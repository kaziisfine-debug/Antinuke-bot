import { Guild, ChannelType, CategoryChannel, TextChannel, VoiceChannel, GuildChannel } from "discord.js";
import { getGuildSettings, updateGuildSettings } from "../database.js";
import { logger } from "../../lib/logger.js";

// Thread channel types — they lack rawPosition / permissionOverwrites
const THREAD_TYPES = new Set([
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

interface ChannelSnapshot {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  permissionOverwrites: Array<{ id: string; type: number; allow: string; deny: string }>;
  bitrate?: number;
  userLimit?: number;
}

interface RoleSnapshot {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  mentionable: boolean;
}

interface GuildSnapshot {
  name: string;
  channels: ChannelSnapshot[];
  roles: RoleSnapshot[];
  capturedAt: number;
}

export async function captureSnapshot(guild: Guild): Promise<void> {
  try {
    const channels: ChannelSnapshot[] = guild.channels.cache
      .filter(ch => !THREAD_TYPES.has(ch.type))
      .map(ch => {
        const gc = ch as GuildChannel;
        return {
          id: gc.id,
          name: gc.name,
          type: gc.type,
          position: gc.rawPosition,
          parentId: gc.parentId,
          topic: (gc as TextChannel).topic ?? null,
          nsfw: (gc as TextChannel).nsfw ?? false,
          permissionOverwrites: gc.permissionOverwrites.cache.map((po) => ({
            id: po.id,
            type: po.type,
            allow: po.allow.bitfield.toString(),
            deny: po.deny.bitfield.toString(),
          })),
          bitrate: (gc as VoiceChannel).bitrate,
          userLimit: (gc as VoiceChannel).userLimit,
        };
      });

    const roles: RoleSnapshot[] = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
      }));

    const snapshot: GuildSnapshot = {
      name: guild.name,
      channels,
      roles,
      capturedAt: Date.now(),
    };

    await updateGuildSettings(guild.id, { snapshotData: snapshot as unknown as Record<string, unknown> });
    logger.info({ guildId: guild.id, channels: channels.length, roles: roles.length }, "Guild snapshot captured");
  } catch (err) {
    logger.error({ err, guildId: guild.id }, "Failed to capture guild snapshot");
  }
}

export async function recoverDeletedChannel(guild: Guild, deletedChannelId: string): Promise<void> {
  try {
    const settings = await getGuildSettings(guild.id);
    if (!settings.snapshotData) return;

    const snapshot = settings.snapshotData as unknown as GuildSnapshot;
    const channelData = snapshot.channels.find(c => c.id === deletedChannelId);
    if (!channelData) return;

    logger.info({ guildId: guild.id, channelId: deletedChannelId, name: channelData.name }, "Recovering deleted channel");

    const permissionOverwrites = channelData.permissionOverwrites.map(po => ({
      id: po.id,
      type: po.type as 0 | 1,
      allow: BigInt(po.allow),
      deny: BigInt(po.deny),
    }));

    let parent: CategoryChannel | null = null;
    if (channelData.parentId) {
      parent = guild.channels.cache.get(channelData.parentId) as CategoryChannel | null;
    }

    const channelType = channelData.type as ChannelType;

    if (channelType === ChannelType.GuildCategory) {
      await guild.channels.create({
        name: channelData.name,
        type: ChannelType.GuildCategory,
        position: channelData.position,
        permissionOverwrites,
        reason: "[ANTINUKE RECOVERY] Restored deleted category",
      });
    } else if (channelType === ChannelType.GuildVoice) {
      await guild.channels.create({
        name: channelData.name,
        type: ChannelType.GuildVoice,
        parent: parent ?? undefined,
        bitrate: channelData.bitrate,
        userLimit: channelData.userLimit,
        permissionOverwrites,
        reason: "[ANTINUKE RECOVERY] Restored deleted voice channel",
      });
    } else {
      await guild.channels.create({
        name: channelData.name,
        type: ChannelType.GuildText,
        parent: parent ?? undefined,
        topic: channelData.topic ?? undefined,
        nsfw: channelData.nsfw,
        permissionOverwrites,
        reason: "[ANTINUKE RECOVERY] Restored deleted text channel",
      });
    }
  } catch (err) {
    logger.error({ err, guildId: guild.id, deletedChannelId }, "Failed to recover deleted channel");
  }
}

export async function recoverDeletedRole(guild: Guild, deletedRoleId: string): Promise<void> {
  try {
    const settings = await getGuildSettings(guild.id);
    if (!settings.snapshotData) return;

    const snapshot = settings.snapshotData as unknown as GuildSnapshot;
    const roleData = snapshot.roles.find(r => r.id === deletedRoleId);
    if (!roleData) return;

    logger.info({ guildId: guild.id, roleId: deletedRoleId, name: roleData.name }, "Recovering deleted role");

    await guild.roles.create({
      name: roleData.name,
      color: roleData.color,
      hoist: roleData.hoist,
      permissions: BigInt(roleData.permissions),
      mentionable: roleData.mentionable,
      reason: "[ANTINUKE RECOVERY] Restored deleted role",
    });
  } catch (err) {
    logger.error({ err, guildId: guild.id, deletedRoleId }, "Failed to recover deleted role");
  }
}

export async function updateSnapshot(guild: Guild): Promise<void> {
  await captureSnapshot(guild);
}
