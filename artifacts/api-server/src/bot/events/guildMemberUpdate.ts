import { GuildMember, PartialGuildMember, Role } from "discord.js";
import { getAllUnbypssableRoles } from "../database.js";
import { logNicknameChange, logMemberTimeout, logMemberRoleChange } from "../systems/logging.js";
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

    const old = oldMember as GuildMember;

    // Log nickname change
    const oldNick = old.nickname ?? null;
    const newNick = newMember.nickname ?? null;
    if (oldNick !== newNick) {
      await logNicknameChange(newMember, oldNick, newNick);
    }

    // Log timeout changes
    const oldTimeout = old.communicationDisabledUntil ?? null;
    const newTimeout = newMember.communicationDisabledUntil ?? null;
    const timeoutChanged =
      (oldTimeout === null && newTimeout !== null) ||
      (oldTimeout !== null && newTimeout === null);
    if (timeoutChanged) {
      await logMemberTimeout(newMember, newTimeout);
    }

    // Log role changes
    if (!old.partial) {
      const oldRoleIds = new Set(old.roles.cache.keys());
      const newRoleIds = new Set(newMember.roles.cache.keys());
      const addedRoles: Role[] = [];
      const removedRoles: Role[] = [];
      for (const [id, role] of newMember.roles.cache) {
        if (!oldRoleIds.has(id)) addedRoles.push(role);
      }
      for (const [id, role] of old.roles.cache) {
        if (!newRoleIds.has(id)) removedRoles.push(role);
      }
      if (addedRoles.length || removedRoles.length) {
        await logMemberRoleChange(newMember, addedRoles, removedRoles);
      }
    }
  } catch (err) {
    logger.error({ err }, "guildMemberUpdate error");
  }
}
