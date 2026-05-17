import { Interaction, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { handleCommand } from "../commands/index.js";
import { handleGiveawayEntry } from "../systems/giveaway.js";
import { handleTicketCreate, handleTicketClose, handleTicketClaim } from "../systems/tickets.js";
import { handleVerifyButton, handleVerifyModal } from "../systems/verification.js";
import { logger } from "../../lib/logger.js";

export async function onInteractionCreate(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction as ChatInputCommandInteraction);
      return;
    }

    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const id = btn.customId;

      if (id.startsWith("giveaway:enter:")) {
        await handleGiveawayEntry(btn);
      } else if (id === "ticket:create") {
        await handleTicketCreate(btn);
      } else if (id === "ticket:close") {
        await handleTicketClose(btn);
      } else if (id === "ticket:claim") {
        await handleTicketClaim(btn);
      } else if (id.startsWith("verify:")) {
        await handleVerifyButton(btn);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;
      if (modal.customId.startsWith("verify_modal:")) {
        await handleVerifyModal(modal);
      }
      return;
    }
  } catch (err) {
    logger.error({ err, type: interaction.type }, "interactionCreate error");
  }
}
