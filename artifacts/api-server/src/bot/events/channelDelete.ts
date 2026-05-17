import { GuildChannel, AuditLogEvent, DMChannel, NonThreadGuildBasedChannel } from "discord.js";
import { checkAction, getAuditLogUser, isTrustedUser } from "../systems/antinuke.js";
import { logChannelDelete } from "../systems/logging.js";
import { recoverDeletedChannel } from "../systems/recovery.js";
import { getGuildSettings } from "../database.js";
import { logger } from "../../lib/logger.js";

export async function onChannelDelete(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
  if (!("guild" in channel) || !channel.guild) return;
  const channelId = channel.id;
  const channelName = channel.name;
  const guild = channel.guild;

  try {
    await logChannelDelete(guild, channelName, channelId);

    const executorId = await getAuditLogUser(guild, AuditLogEvent.ChannelDelete);
    if (!executorId || executorId === guild.client.user?.id) return;

    const settings = await getGuildSettings(guild.id);
    if (!settings.antiNukeEnabled) return;

    const trusted = await isTrustedUser(guild, executorId);
    const triggered = await checkAction(guild, executorId, "channelDelete");

    // Always recover deleted channels if executor is not trusted
    if (!trusted) {
      await recoverDeletedChannel(guild, channelId);
    }
  } catch (err) {
    logger.error({ err }, "channelDelete error");
  }
}
