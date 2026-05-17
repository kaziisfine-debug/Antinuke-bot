import { GuildMember, PartialGuildMember } from "discord.js";
import { getAllUnbypssableRoles } from "../database.js";
import { logNicknameChange } from "../systems/logging.js";
import { UNBYPSSABLE_ROLE_NAME } from "../config.js";
import { logger } from "../../lib/logger.js";

export async function onGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void> {
  try {
    // Unbypssable role enforcement
    const protected_ = await getAllUnbypssableRoles(newMember.guild.id);
    const userProtect = protected_.find(p => p.userId === newMember.id);
    if (userProtect) {
      if (!newMember.roles.cache.has(userProtect.roleId)) {
        const role = newMember.guild.roles.cache.get(userProtect.roleId);
        if (role) {
          await newMember.roles.add(role, "Guardian — Restoring unbypssable role").catch(err =>
            logger.warn({ err }, "Failed to restore unbypssable role")
          );
        }
      }
    }

    // Log nickname change
    const oldNick = (oldMember as GuildMember).nickname ?? null;
    const newNick = newMember.nickname ?? null;
    if (oldNick !== newNick) {
      await logNicknameChange(newMember, oldNick, newNick);
    }
  } catch (err) {
    logger.error({ err }, "guildMemberUpdate error");
  }
}
