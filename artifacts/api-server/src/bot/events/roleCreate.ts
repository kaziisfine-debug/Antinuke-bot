import { Role, AuditLogEvent } from "discord.js";
import { checkAction, getAuditLogUser } from "../systems/antinuke.js";
import { logRoleCreate } from "../systems/logging.js";
import { updateSnapshot } from "../systems/recovery.js";
import { logger } from "../../lib/logger.js";

export async function onRoleCreate(role: Role): Promise<void> {
  try {
    await logRoleCreate(role.guild, role);

    const executorId = await getAuditLogUser(role.guild, AuditLogEvent.RoleCreate);
    if (!executorId || executorId === role.guild.client.user?.id) return;

    const triggered = await checkAction(role.guild, executorId, "roleCreate");
    if (!triggered) await updateSnapshot(role.guild);
  } catch (err) {
    logger.error({ err }, "roleCreate error");
  }
}
