import { GuildMember } from "discord.js";
import { handleMemberJoin } from "../systems/welcome.js";
import { sendVerificationChallenge } from "../systems/verification.js";
import { trackJoin } from "../systems/antiraid.js";
import { logMemberJoin } from "../systems/logging.js";
import { getGuildSettings } from "../database.js";
import { logger } from "../../lib/logger.js";

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    const settings = await getGuildSettings(member.guild.id);

    // Anti-raid check first
    const raidTriggered = await trackJoin(member.guild, member);
    if (raidTriggered) {
      await member.kick("Anti-raid lockdown active").catch(() => {});
      return;
    }

    // Auto-kick accounts younger than 1 day if anti-raid is on
    if (settings.antiRaidEnabled) {
      const accountAge = Date.now() - member.user.createdTimestamp;
      if (accountAge < 24 * 60 * 60 * 1000) {
        await member.kick("Account too new (anti-raid protection)").catch(() => {});
        return;
      }
    }

    // Verification system
    if (settings.verificationEnabled) {
      await sendVerificationChallenge(member);
    } else {
      // Only give auto-roles / welcome if not using verification
      await handleMemberJoin(member);
    }

    await logMemberJoin(member);
  } catch (err) {
    logger.error({ err, guildId: member.guild.id, userId: member.id }, "guildMemberAdd error");
  }
}
