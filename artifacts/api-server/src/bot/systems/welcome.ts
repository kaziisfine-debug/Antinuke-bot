import { Guild, GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import { getGuildSettings, getAutoRoles } from "../database.js";
import { COLORS } from "../config.js";
import { logger } from "../../lib/logger.js";

function replacePlaceholders(template: string, member: GuildMember): string {
  return template
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString())
    .replace(/{tag}/g, member.user.tag);
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const settings = await getGuildSettings(member.guild.id);

  // Auto-roles
  const autoRoles = await getAutoRoles(member.guild.id);
  for (const ar of autoRoles) {
    const role = member.guild.roles.cache.get(ar.roleId);
    if (role) {
      await member.roles.add(role, "Auto-role on join").catch(err =>
        logger.warn({ err, guildId: member.guild.id, roleId: ar.roleId }, "Failed to assign auto-role")
      );
    }
  }

  // Welcome message
  if (settings.welcomeEnabled && settings.welcomeChannelId) {
    const ch = member.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel | undefined;
    if (ch) {
      const msg = settings.welcomeMessage
        ? replacePlaceholders(settings.welcomeMessage, member)
        : `Welcome to **${member.guild.name}**, <@${member.id}>! You are member #${member.guild.memberCount}.`;

      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.green)
          .setTitle("👋 Welcome!")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `Member #${member.guild.memberCount}` })
          .setTimestamp()],
      }).catch(err => logger.warn({ err }, "Failed to send welcome message"));
    }
  }
}

export async function handleMemberLeave(member: GuildMember): Promise<void> {
  const settings = await getGuildSettings(member.guild.id);

  if (settings.goodbyeEnabled && settings.goodbyeChannelId) {
    const ch = member.guild.channels.cache.get(settings.goodbyeChannelId) as TextChannel | undefined;
    if (ch) {
      const msg = settings.goodbyeMessage
        ? settings.goodbyeMessage
            .replace(/{user}/g, member.user.tag)
            .replace(/{username}/g, member.user.username)
            .replace(/{server}/g, member.guild.name)
        : `**${member.user.tag}** has left the server. We now have ${member.guild.memberCount} members.`;

      await ch.send({
        embeds: [new EmbedBuilder()
          .setColor(COLORS.orange)
          .setTitle("👋 Goodbye!")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setTimestamp()],
      }).catch(err => logger.warn({ err }, "Failed to send goodbye message"));
    }
  }
}
