import { Invite } from "discord.js";
import { logInviteCreate } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onInviteCreate(invite: Invite): Promise<void> {
  try {
    await logInviteCreate(invite);
  } catch (err) {
    logger.error({ err }, "inviteCreate error");
  }
}

export async function onInviteDelete(invite: Invite): Promise<void> {
  try {
    const { logInviteDelete } = await import("../systems/logging.js");
    await logInviteDelete(invite);
  } catch (err) {
    logger.error({ err }, "inviteDelete error");
  }
}
