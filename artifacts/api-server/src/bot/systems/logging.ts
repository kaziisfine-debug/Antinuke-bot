import {
  Guild, GuildMember, Message, TextChannel, EmbedBuilder,
  AuditLogEvent, User, Role, GuildChannel, PartialMessage,
  PartialGuildMember,
} from "discord.js";
import { getLogConfig } from "../database.js";
import { COLORS } from "../config.js";

async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.logChannelId) return null;
  const ch = guild.channels.cache.get(cfg.logChannelId);
  return (ch as TextChannel) ?? null;
}

async function send(guild: Guild, embed: EmbedBuilder) {
  const ch = await getLogChannel(guild);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  const cfg = await getLogConfig(message.guild.id);
  if (!cfg.messageDelete || !cfg.logChannelId) return;

  await send(message.guild, new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("🗑️ Message Deleted")
    .addFields(
      { name: "Author", value: message.author ? `<@${message.author.id}> (${message.author.tag})` : "Unknown", inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      { name: "Content", value: message.content?.slice(0, 1024) || "*No text content*" },
    )
    .setTimestamp());
}

export async function logMessageEdit(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const cfg = await getLogConfig(newMessage.guild.id);
  if (!cfg.messageEdit || !cfg.logChannelId) return;

  await send(newMessage.guild, new EmbedBuilder()
    .setColor(COLORS.yellow)
    .setTitle("✏️ Message Edited")
    .setURL(newMessage.url)
    .addFields(
      { name: "Author", value: newMessage.author ? `<@${newMessage.author.id}>` : "Unknown", inline: true },
      { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Before", value: oldMessage.content?.slice(0, 512) || "*Unknown*" },
      { name: "After", value: newMessage.content?.slice(0, 512) || "*Empty*" },
    )
    .setTimestamp());
}

export async function logMemberJoin(member: GuildMember): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.memberJoin || !cfg.logChannelId) return;

  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

  await send(member.guild, new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle("📥 Member Joined")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "User", value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: "ID", value: member.id, inline: true },
      { name: "Account Age", value: `${accountAge} days`, inline: true },
      { name: "Member Count", value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp());
}

export async function logMemberLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.memberLeave || !cfg.logChannelId) return;

  await send(member.guild, new EmbedBuilder()
    .setColor(COLORS.orange)
    .setTitle("📤 Member Left")
    .setThumbnail(member.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "User", value: `<@${member.id}> (${member.user?.tag ?? "Unknown"})`, inline: true },
      { name: "ID", value: member.id, inline: true },
      { name: "Member Count", value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp());
}

export async function logBanAdd(guild: Guild, user: User): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.memberBan || !cfg.logChannelId) return;

  let reason = "No reason provided";
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBan });
    const entry = logs.entries.find(e => (e.target as User)?.id === user.id);
    if (entry?.reason) reason = entry.reason;
  } catch {}

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("🔨 Member Banned")
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "User", value: `<@${user.id}> (${user.tag})`, inline: true },
      { name: "ID", value: user.id, inline: true },
      { name: "Reason", value: reason },
    )
    .setTimestamp());
}

export async function logBanRemove(guild: Guild, user: User): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.memberUnban || !cfg.logChannelId) return;

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle("✅ Member Unbanned")
    .addFields(
      { name: "User", value: `<@${user.id}> (${user.tag})`, inline: true },
      { name: "ID", value: user.id, inline: true },
    )
    .setTimestamp());
}

export async function logRoleCreate(guild: Guild, role: Role): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.roleCreate || !cfg.logChannelId) return;

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle("✨ Role Created")
    .addFields(
      { name: "Role", value: `<@&${role.id}> (${role.name})`, inline: true },
      { name: "ID", value: role.id, inline: true },
    )
    .setTimestamp());
}

export async function logRoleDelete(guild: Guild, roleName: string, roleId: string): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.roleDelete || !cfg.logChannelId) return;

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("🗑️ Role Deleted")
    .addFields(
      { name: "Role Name", value: roleName, inline: true },
      { name: "ID", value: roleId, inline: true },
    )
    .setTimestamp());
}

export async function logChannelCreate(guild: Guild, channel: GuildChannel): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.channelCreate || !cfg.logChannelId) return;

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.green)
    .setTitle("📢 Channel Created")
    .addFields(
      { name: "Channel", value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: "ID", value: channel.id, inline: true },
    )
    .setTimestamp());
}

export async function logChannelDelete(guild: Guild, channelName: string, channelId: string): Promise<void> {
  const cfg = await getLogConfig(guild.id);
  if (!cfg.channelDelete || !cfg.logChannelId) return;

  await send(guild, new EmbedBuilder()
    .setColor(COLORS.red)
    .setTitle("🗑️ Channel Deleted")
    .addFields(
      { name: "Channel Name", value: channelName, inline: true },
      { name: "ID", value: channelId, inline: true },
    )
    .setTimestamp());
}

export async function logNicknameChange(member: GuildMember, oldNick: string | null, newNick: string | null): Promise<void> {
  const cfg = await getLogConfig(member.guild.id);
  if (!cfg.nicknameChange || !cfg.logChannelId) return;

  await send(member.guild, new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("📝 Nickname Changed")
    .addFields(
      { name: "User", value: `<@${member.id}>`, inline: true },
      { name: "Before", value: oldNick ?? "*None*", inline: true },
      { name: "After", value: newNick ?? "*None*", inline: true },
    )
    .setTimestamp());
}
