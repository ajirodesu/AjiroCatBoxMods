/**
 * Dice Roller
 * Classic RNG dice rolling with support for custom sides and counts.
 * Added preset buttons for quick rolls.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';

export const config = {
  name: 'dice',
  aliases: ['roll', 'dnd', 'r'] as string[],
  version: '1.2.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Roll the dice and test your luck!',
  category: 'Fun',
  usage: '[count] [sides] (Default: 1 6)',
  cooldown: 3,
  hasPrefix: true,
};

const NUM_WORDS: Record<number, string> = {
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
};

const BUTTON_ID = {
  d6: 'd6',
  d2d6: 'd2d6',
  d20: 'd20',
} as const;

function rollDice(numDice: number, numSides: number): { rolls: number[]; total: number } {
  const rolls: number[] = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * numSides) + 1);
  }
  const total = rolls.reduce((acc, curr) => acc + curr, 0);
  return { rolls, total };
}

function buildResultMessage(numDice: number, numSides: number, rolls: number[], total: number): string {
  let rollsStr = rolls.join(', ');
  if (rollsStr.length > 3000) {
    rollsStr = rolls.slice(0, 50).join(', ') + ` ...and ${rolls.length - 50} more`;
  }

  return (
    `🎲 **Dice Roll**\n` +
    `Settings: **${numDice}**d**${numSides}**\n\n` +
    `>>> **${rollsStr}**\n\n` +
    `📊 **Total:** ${total}`
  );
}

async function sendDiceRoll(
  chat: AppCtx['chat'],
  numDice: number,
  numSides: number,
  withButtons = false,
): Promise<void> {
  if (numDice <= 0 || numDice > 100) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ **Limit Exceeded**\nPlease choose between **1** and **100** dice.',
    });
    return;
  }

  if (numSides <= 1 || numSides > 1000) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ **Invalid Sides**\nPlease choose between **2** and **1000** sides.',
    });
    return;
  }

  const { rolls, total } = rollDice(numDice, numSides);
  const resultMsg = buildResultMessage(numDice, numSides, rolls, total);

  const replyBase = {
    style: MessageStyle.MARKDOWN,
    message: resultMsg,
  };

  const buttons = withButtons
    ? [
        { id: BUTTON_ID.d6, label: '🎲 1d6', style: ButtonStyle.PRIMARY },
        { id: BUTTON_ID.d2d6, label: '🎯 2d6', style: ButtonStyle.SECONDARY },
        { id: BUTTON_ID.d20, label: '🧭 1d20', style: ButtonStyle.SUCCESS },
      ]
    : [];

  if (withButtons) {
    try {
      if (numDice === 1 && numSides === 6) {
        const val = rolls[0]!;
        const word = NUM_WORDS[val];
        const imageUrl = `https://www.clker.com/cliparts/M/k/N/Z/2/p/rolling-dice-${word}-md.png`;

        await chat.replyMessage({
          ...replyBase,
          attachment_url: [{ name: `dice_${word}.png`, url: imageUrl }],
          button: buttons.map((b) =>
            chat.button.generateID({
              id: b.id,
              public: true,
            }),
          ),
        });
        return;
      }
    } catch {
      // fallback below
    }

    await chat.replyMessage({
      ...replyBase,
      button: buttons.map((b) =>
        chat.button.generateID({
          id: b.id,
          public: true,
        }),
      ),
    });
    return;
  }

  if (numDice === 1 && numSides === 6) {
    const val = rolls[0]!;
    const word = NUM_WORDS[val];
    const imageUrl = `https://www.clker.com/cliparts/M/k/N/Z/2/p/rolling-dice-${word}-md.png`;

    try {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: resultMsg,
        attachment_url: [{ name: `dice_${word}.png`, url: imageUrl }],
      });
      return;
    } catch {
      // Fallback to text
    }
  }

  await chat.replyMessage(replyBase);
}

export const button = {
  [BUTTON_ID.d6]: {
    label: '🎲 1d6',
    style: ButtonStyle.PRIMARY,
    onClick: async ({ chat }: AppCtx) => {
      await sendDiceRoll(chat, 1, 6, true);
    },
  },

  [BUTTON_ID.d2d6]: {
    label: '🎯 2d6',
    style: ButtonStyle.SECONDARY,
    onClick: async ({ chat }: AppCtx) => {
      await sendDiceRoll(chat, 2, 6, true);
    },
  },

  [BUTTON_ID.d20]: {
    label: '🧭 1d20',
    style: ButtonStyle.SUCCESS,
    onClick: async ({ chat }: AppCtx) => {
      await sendDiceRoll(chat, 1, 20, true);
    },
  },
};

export const onCommand = async ({ args, chat, button }: AppCtx): Promise<void> => {
  const numDice = parseInt(args[0] ?? '') || 1;
  const numSides = parseInt(args[1] ?? '') || 6;

  const { rolls, total } = rollDice(numDice, numSides);
  const resultMsg = buildResultMessage(numDice, numSides, rolls, total);

  const buttons = [
    button.generateID({ id: BUTTON_ID.d6, public: true }),
    button.generateID({ id: BUTTON_ID.d2d6, public: true }),
    button.generateID({ id: BUTTON_ID.d20, public: true }),
  ];

  if (numDice === 1 && numSides === 6) {
    const val = rolls[0]!;
    const word = NUM_WORDS[val];
    const imageUrl = `https://www.clker.com/cliparts/M/k/N/Z/2/p/rolling-dice-${word}-md.png`;

    try {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: resultMsg,
        attachment_url: [{ name: `dice_${word}.png`, url: imageUrl }],
        button: buttons,
      });
      return;
    } catch {
      // fallback below
    }
  }

  if (numDice <= 0 || numDice > 100) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ **Limit Exceeded**\nPlease choose between **1** and **100** dice.',
      button: buttons,
    });
    return;
  }

  if (numSides <= 1 || numSides > 1000) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '⚠️ **Invalid Sides**\nPlease choose between **2** and **1000** sides.',
      button: buttons,
    });
    return;
  }

  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: resultMsg,
    button: buttons,
  });
};