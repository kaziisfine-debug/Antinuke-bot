import { VoiceState } from "discord.js";
import { logVoiceState } from "../systems/logging.js";
import { logger } from "../../lib/logger.js";

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  try {
    await logVoiceState(oldState, newState);
  } catch (err) {
    logger.error({ err }, "voiceStateUpdate error");
  }
}
