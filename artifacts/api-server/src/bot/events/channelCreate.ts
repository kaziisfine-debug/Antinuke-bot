import { GuildChannel, AuditLogEvent, NonThreadGuildBasedChannel } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logChannelCreate } from "../systems/logging.js";
import { updateSnapshot } from "../systems/recovery.js";
import { logger } from "../../lib/logger.js";

export async function onChannelCreate(channel: NonThreadGuildBasedChannel): Promise<void> {
  if (!channel.guild) return;
  try {
    await logChannelCreate(channel.guild, channel as GuildChannel);

    const executorId = await getAuditLogUser(channel.guild, AuditLogEvent.ChannelCreate);
    if (!executorId || executorId === channel.guild.client.user?.id) return;

    const triggered = await checkAction(channel.guild, executorId, "channelCreate");
    if (!triggered) await updateSnapshot(channel.guild);
  } catch (err) {
    logger.error({ err }, "channelCreate error");
  }
}
