import { Role, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logRoleUpdate } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onRoleUpdate(oldRole: Role, newRole: Role): Promise<void> {
  if (!newRole.guild) return;
  try {
    await logRoleUpdate(oldRole, newRole);

    const executorId = await getAuditLogUser(newRole.guild, AuditLogEvent.RoleUpdate);
    if (!executorId || executorId === newRole.guild.client.user?.id) return;
    await checkAction(newRole.guild, executorId, "roleUpdate", `@${newRole.name}`);
  } catch (err) {
    logger.error({ err }, "roleUpdate error");
  }
}
