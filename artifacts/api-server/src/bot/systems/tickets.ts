import {
  Guild, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, PermissionFlagsBits, ChannelType, ButtonInteraction,
  OverwriteType,
} from "discord.js";
import {
  getTicketPanel, createTicketPanel, updateTicketPanel,
  getNextTicketNumber, createTicket, getTicketByChannel, updateTicket,
} from "../database.js";
import { COLORS } from "../config.js";
import { logger } from "../../lib/logger.js";

export async function sendTicketPanel(guild: Guild, channel: TextChannel, categoryId?: string, supportRoleId?: string): Promise<void> {
  const existing = await getTicketPanel(guild.id);

  const embed = new EmbedBuilder()
    .setColor(COLORS.blue)
    .setTitle("🎫 Support Tickets")
    .setDescription("Need help? Click the button below to open a support ticket.\nOur team will assist you as soon as possible.")
    .setFooter({ text: guild.name })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:create")
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎫")
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  if (existing) {
    await updateTicketPanel(guild.id, {
      channelId: channel.id,
      messageId: msg.id,
      categoryId: categoryId ?? existing.categoryId ?? undefined,
      supportRoleId: supportRoleId ?? existing.supportRoleId ?? undefined,
    });
  } else {
    await createTicketPanel({
      guildId: guild.id,
      channelId: channel.id,
      messageId: msg.id,
      categoryId,
      supportRoleId,
    });
  }
}

export async function handleTicketCreate(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;

  const panel = await getTicketPanel(interaction.guild.id);
  if (!panel) {
    await interaction.reply({ content: "❌ Ticket system not configured.", ephemeral: true });
    return;
  }

  // Check if user already has an open ticket
  const existingTickets = await interaction.guild.channels.cache.filter(c =>
    c.name.startsWith(`ticket-${interaction.user.username.toLowerCase().slice(0, 10)}`)
  );

  if (existingTickets.size > 0) {
    await interaction.reply({ content: `❌ You already have an open ticket! Check your existing ticket channel.`, ephemeral: true });
    return;
  }

  const ticketNum = await getNextTicketNumber(interaction.guild.id);
  const channelName = `ticket-${interaction.user.username.toLowerCase().slice(0, 10)}-${ticketNum}`;

  const permissionOverwrites: any[] = [
    {
      id: interaction.guild.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
  ];

  if (panel.supportRoleId) {
    permissionOverwrites.push({
      id: panel.supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  const botId = interaction.client.user!.id;
  permissionOverwrites.push({
    id: botId,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
  });

  const ticketChannel = await interaction.guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: panel.categoryId ?? undefined,
    permissionOverwrites,
    reason: `Ticket #${ticketNum} opened by ${interaction.user.tag}`,
  }) as TextChannel;

  await createTicket({
    guildId: interaction.guild.id,
    channelId: ticketChannel.id,
    userId: interaction.user.id,
    ticketNumber: ticketNum,
    status: "open",
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.blue)
    .setTitle(`🎫 Ticket #${ticketNum}`)
    .setDescription(`Hello <@${interaction.user.id}>! A staff member will assist you shortly.\n\nPlease describe your issue below.`)
    .addFields({ name: "Opened by", value: `<@${interaction.user.id}>`, inline: true })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
    new ButtonBuilder().setCustomId("ticket:claim").setLabel("Claim Ticket").setStyle(ButtonStyle.Success).setEmoji("✋"),
  );

  await ticketChannel.send({
    content: `<@${interaction.user.id}>${panel.supportRoleId ? ` | <@&${panel.supportRoleId}>` : ""}`,
    embeds: [embed],
    components: [row],
  });

  await interaction.reply({ content: `✅ Your ticket has been created: ${ticketChannel}`, ephemeral: true });
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel) return;

  const ticket = await getTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.red)
      .setDescription("🔒 Ticket closing in 5 seconds...")],
  });

  await updateTicket(interaction.channel.id, { status: "closed", closedAt: new Date() });

  setTimeout(async () => {
    (interaction.channel as TextChannel).delete("[TICKET] Closed by staff").catch(() => {});
  }, 5000);
}

export async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel) return;

  const ticket = await getTicketByChannel(interaction.channel.id);
  if (!ticket) {
    await interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
    return;
  }

  await updateTicket(interaction.channel.id, { claimedBy: interaction.user.id });

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(COLORS.success)
      .setDescription(`✋ Ticket claimed by <@${interaction.user.id}>`)],
  });
}
