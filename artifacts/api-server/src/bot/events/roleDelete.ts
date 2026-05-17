import { Role, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser, isTrustedUser } from "../systems/antinuke.js";
import { logRoleDelete } from "../systems/logging.js";
import { recoverDeletedRole } from "../systems/recovery.js";
import { getGuildSettings } from "../database.js";
import { UNBYPSSABLE_ROLE_NAME } from "../config.js";
import { logger } from "../../lib/logger.js";

export async function onRoleDelete(role: Role): Promise<void> {
  const roleId = role.id;
  const roleName = role.name;
  const guild = role.guild;

  try {
    await logRoleDelete(guild, roleName, roleId);

    const executorId = await getAuditLogUser(guild, AuditLogEvent.RoleDelete);
    if (!executorId || executorId === guild.client.user?.id) return;

    const settings = await getGuildSettings(guild.id);
    if (!settings.antiNukeEnabled) return;

    const trusted = await isTrustedUser(guild, executorId);
    await checkAction(guild, executorId, "roleDelete");

    // Recover if not trusted
    if (!trusted) {
      await recoverDeletedRole(guild, roleId);
    }

    // If the unbypssable role was deleted, recreate it immediately
    if (roleName === UNBYPSSABLE_ROLE_NAME) {
      const newRole = await guild.roles.create({
        name: UNBYPSSABLE_ROLE_NAME,
        color: 0xf39c12,
        reason: "Guardian — Unbypssable role recreated",
      }).catch(() => null);

      if (newRole) {
        // Re-add to all protected users
        const { getAllUnbypssableRoles, setUnbypssableRole } = await import("../database.js");
        const protected_ = await getAllUnbypssableRoles(guild.id);
        for (const p of protected_) {
          await setUnbypssableRole(guild.id, p.userId, newRole.id);
          const member = await guild.members.fetch(p.userId).catch(() => null);
          if (member) await member.roles.add(newRole, "Guardian — Unbypssable role restore").catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "roleDelete error");
  }
}
