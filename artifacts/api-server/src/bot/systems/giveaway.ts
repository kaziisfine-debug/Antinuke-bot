import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from "discord.js";
import { createGiveaway, getGiveaway, updateGiveaway, getGiveawayEntries, enterGiveaway, getActiveGiveaways } from "../database.js";
import { COLORS } from "../config.js";
import { logger } from "../../lib/logger.js";

const giveawayTimers = new Map<number, ReturnType<typeof setTimeout>>();

export async function startGiveaway(
  client: Client,
  guildId: string,
  channelId: string,
  hostId: string,
  prize: string,
  winnersCount: number,
  durationMs: number,
  requirements?: string,
): Promise<{ success: boolean; id?: number; error?: string }> {
  const endsAt = new Date(Date.now() + durationMs);

  const giveaway = await createGiveaway({ guildId, channelId, hostId, prize, winnersCount, endsAt, requirements });

  const channel = client.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel) return { success: false, error: "Channel not found." };

  const embed = buildGiveawayEmbed(prize, winnersCount, hostId, endsAt, 0, requirements);
  const row = buildGiveawayRow(giveaway.id);

  const msg = await channel.send({ embeds: [embed], components: [row] });
  await updateGiveaway(giveaway.id, { messageId: msg.id });

  scheduleGiveawayEnd(client, giveaway.id, durationMs);

  return { success: true, id: giveaway.id };
}

function buildGiveawayEmbed(prize: string, winnersCount: number, hostId: string, endsAt: Date, entries: number, requirements?: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.giveaway)
    .setTitle(`🎉 GIVEAWAY — ${prize}`)
    .addFields(
      { name: "Winners", value: `${winnersCount}`, inline: true },
      { name: "Entries", value: `${entries}`, inline: true },
      { name: "Hosted by", value: `<@${hostId}>`, inline: true },
      { name: "Ends", value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: "Click 🎉 to enter!" })
    .setTimestamp(endsAt);

  if (requirements) embed.addFields({ name: "Requirements", value: requirements });

  return embed;
}

function buildGiveawayRow(id: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:enter:${id}`)
      .setLabel("Enter Giveaway")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🎉")
  );
}

export async function handleGiveawayEntry(interaction: ButtonInteraction): Promise<void> {
  const [, , idStr] = interaction.customId.split(":");
  const id = parseInt(idStr!, 10);
  const giveaway = await getGiveaway(id);

  if (!giveaway || giveaway.ended) {
    await interaction.reply({ content: "This giveaway has ended.", ephemeral: true });
    return;
  }

  await enterGiveaway(id, interaction.user.id);
  const entries = await getGiveawayEntries(id);

  // Update entry count on embed
  const channel = interaction.channel as TextChannel;
  if (channel && giveaway.messageId) {
    const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (msg) {
      const embed = buildGiveawayEmbed(
        giveaway.prize, giveaway.winnersCount, giveaway.hostId,
        giveaway.endsAt, entries.length, giveaway.requirements
      );
      await msg.edit({ embeds: [embed], components: [buildGiveawayRow(id)] }).catch(() => {});
    }
  }

  await interaction.reply({ content: "✅ You've entered the giveaway! Good luck!", ephemeral: true });
}

function scheduleGiveawayEnd(client: Client, id: number, delayMs: number) {
  if (giveawayTimers.has(id)) clearTimeout(giveawayTimers.get(id)!);
  const timer = setTimeout(() => endGiveaway(client, id), Math.max(delayMs, 0));
  giveawayTimers.set(id, timer);
}

async function endGiveaway(client: Client, id: number) {
  giveawayTimers.delete(id);
  const giveaway = await getGiveaway(id);
  if (!giveaway || giveaway.ended) return;

  const entries = await getGiveawayEntries(id);
  const winners: string[] = [];

  if (entries.length > 0) {
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(giveaway.winnersCount, shuffled.length); i++) {
      winners.push(shuffled[i]!.userId);
    }
  }

  await updateGiveaway(id, { ended: true, winnerIds: winners });

  const channel = client.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
  if (channel) {
    if (giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) {
        const endEmbed = new EmbedBuilder()
          .setColor(winners.length > 0 ? COLORS.success : COLORS.red)
          .setTitle(`🎉 GIVEAWAY ENDED — ${giveaway.prize}`)
          .addFields(
            { name: "Winners", value: winners.length > 0 ? winners.map(w => `<@${w}>`).join(", ") : "No winners (no entries)", inline: false },
            { name: "Hosted by", value: `<@${giveaway.hostId}>`, inline: true },
            { name: "Total Entries", value: `${entries.length}`, inline: true },
          )
          .setTimestamp();
        await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
      }
    }

    if (winners.length > 0) {
      await channel.send({
        content: `🎉 Congratulations ${winners.map(w => `<@${w}>`).join(", ")}! You won **${giveaway.prize}**!`,
      });
    } else {
      await channel.send({ content: `No one entered the giveaway for **${giveaway.prize}**.` });
    }
  }
}

export async function rerollGiveaway(client: Client, id: number): Promise<string[]> {
  const giveaway = await getGiveaway(id);
  if (!giveaway) return [];

  const entries = await getGiveawayEntries(id);
  if (entries.length === 0) return [];

  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const winners: string[] = [];
  for (let i = 0; i < Math.min(giveaway.winnersCount, shuffled.length); i++) {
    winners.push(shuffled[i]!.userId);
  }

  await updateGiveaway(id, { winnerIds: winners });
  return winners;
}

export async function resumeGiveaways(client: Client) {
  const active = await getActiveGiveaways();
  for (const g of active) {
    const remaining = g.endsAt.getTime() - Date.now();
    if (remaining <= 0) {
      await endGiveaway(client, g.id);
    } else {
      scheduleGiveawayEnd(client, g.id, remaining);
    }
  }
  logger.info({ count: active.length }, "Giveaway timers resumed");
}
