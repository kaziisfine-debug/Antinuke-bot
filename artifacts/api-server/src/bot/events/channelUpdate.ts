import { AuditLogEvent, NonThreadGuildBasedChannel } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logChannelUpdate } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onChannelUpdate(
  oldChannel: NonThreadGuildBasedChannel,
  newChannel: NonThreadGuildBasedChannel,
): Promise<void> {
  if (!newChannel.guild) return;
  try {
    await logChannelUpdate(oldChannel, newChannel);

    const executorId = await getAuditLogUser(newChannel.guild, AuditLogEvent.ChannelUpdate);
    if (!executorId || executorId === newChannel.guild.client.user?.id) return;
    await checkAction(newChannel.guild, executorId, "channelUpdate", `#${newChannel.name}`);
  } catch (err) {
    logger.error({ err }, "channelUpdate error");
  }
}
