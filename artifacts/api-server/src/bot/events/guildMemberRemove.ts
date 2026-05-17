import { GuildMember, PartialGuildMember } from "discord.js";
import { handleMemberLeave } from "../systems/welcome.js";
import { logMemberLeave } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
  try {
    if (member.partial) await member.fetch().catch(() => {});
    await logMemberLeave(member);
    if (!member.partial) await handleMemberLeave(member as GuildMember);
  } catch (err) {
    logger.error({ err, guildId: member.guild.id, userId: member.id }, "guildMemberRemove error");
  }
}
