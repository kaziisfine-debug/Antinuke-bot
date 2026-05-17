import { GuildBan, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logBanAdd } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onGuildBanAdd(ban: GuildBan): Promise<void> {
  try {
    await logBanAdd(ban.guild, ban.user);

    const executorId = await getAuditLogUser(ban.guild, AuditLogEvent.MemberBanAdd);
    if (!executorId || executorId === ban.guild.client.user?.id) return;

    await checkAction(ban.guild, executorId, "ban");
  } catch (err) {
    logger.error({ err }, "guildBanAdd error");
  }
}
