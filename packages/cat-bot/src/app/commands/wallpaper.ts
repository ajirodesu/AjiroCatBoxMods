/**
 * Wallpaper Command
 * Fetches high-quality wallpapers based on keywords or random generation.
 * Added preset topic buttons.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';

const TIMEOUT = 20000;

function parseArgs(args: string[]): { query: string; width: number; height: number } {
  let width = 1920;
  let height = 1080;
  const parts = [...args];

  const lastArg = parts[parts.length - 1] ?? '';
  const match = /^(\d{3,4})x(\d{3,4})$/i.exec(lastArg);
  if (match) {
    width = Math.min(3840, parseInt(match[1]!, 10));
    height = Math.min(2160, parseInt(match[2]!, 10));
    parts.pop();
  }

  const query = parts.join(' ').trim();
  return { query, width, height };
}

const BUTTON_ID = {
  random: 'random',
  nature: 'nature',
  space: 'space',
  city: 'city',
} as const;

const PRESETS = {
  [BUTTON_ID.random]: { label: '🎲 Random', query: '' },
  [BUTTON_ID.nature]: { label: '🌿 Nature', query: 'nature' },
  [BUTTON_ID.space]: { label: '🌌 Space', query: 'space' },
  [BUTTON_ID.city]: { label: '🏙️ City', query: 'city' },
} as const;

export const config = {
  name: 'wallpaper',
  aliases: ['wp', 'wall', 'background'] as string[],
  version: '1.2.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Get a random wallpaper (optionally specify size/topic).',
  category: 'Utility',
  usage: '[query] [WxH]',
  cooldown: 5,
  hasPrefix: true,
};

async function sendWallpaper(
  chat: AppCtx['chat'],
  query: string,
  width: number,
  height: number,
  withButtons = true,
): Promise<void> {
  const loadingId = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: `🖼️ **Finding wallpaper...**\n🔎 Query: _${query || 'Random'}_ (${width}x${height})`,
  });

  try {
    let url: string;
    let sourceName: string;

    if (query) {
      url = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(query)}/all`;
      sourceName = 'LoremFlickr';
    } else {
      url = `https://picsum.photos/${width}/${height}`;
      sourceName = 'Picsum';
    }

    const { data } = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT,
      maxRedirects: 5,
    });

    const caption =
      `🖼️ **Wallpaper Generated**\n` +
      `📐 **Size:** ${width}x${height}\n` +
      `🔎 **Topic:** ${query || 'Random'}\n` +
      `📷 **Source:** ${sourceName}`;

    if (loadingId) {
      await chat.unsendMessage(loadingId as string).catch(() => {});
    }

    const buttons = withButtons
      ? [
          chat.button.generateID({ id: BUTTON_ID.random, public: true }),
          chat.button.generateID({ id: BUTTON_ID.nature, public: true }),
          chat.button.generateID({ id: BUTTON_ID.space, public: true }),
          chat.button.generateID({ id: BUTTON_ID.city, public: true }),
        ]
      : [];

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: caption,
      attachment: [{ name: `wallpaper_${width}x${height}.jpg`, stream: Buffer.from(data) }],
      button: buttons,
    });
  } catch (err) {
    const error = err as { message?: string; response?: { status?: number } };
    let errorMsg = `⚠️ **Generation Failed**\n\`${error.message ?? 'Unknown error'}\``;

    if (error.response?.status === 404) {
      errorMsg = `⚠️ **Not Found**\nCould not find a wallpaper for "_${query}_". Try a simpler term.`;
    }

    if (loadingId) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: loadingId as string,
        message: errorMsg,
      });
    } else {
      await chat.replyMessage({ style: MessageStyle.MARKDOWN, message: errorMsg });
    }
  }
}

export const button = {
  [BUTTON_ID.random]: {
    label: PRESETS[BUTTON_ID.random].label,
    style: ButtonStyle.PRIMARY,
    onClick: async ({ chat }: AppCtx) => {
      await sendWallpaper(chat, '', 1920, 1080, true);
    },
  },

  [BUTTON_ID.nature]: {
    label: PRESETS[BUTTON_ID.nature].label,
    style: ButtonStyle.SECONDARY,
    onClick: async ({ chat }: AppCtx) => {
      await sendWallpaper(chat, 'nature', 1920, 1080, true);
    },
  },

  [BUTTON_ID.space]: {
    label: PRESETS[BUTTON_ID.space].label,
    style: ButtonStyle.SUCCESS,
    onClick: async ({ chat }: AppCtx) => {
      await sendWallpaper(chat, 'space', 1920, 1080, true);
    },
  },

  [BUTTON_ID.city]: {
    label: PRESETS[BUTTON_ID.city].label,
    style: ButtonStyle.DANGER,
    onClick: async ({ chat }: AppCtx) => {
      await sendWallpaper(chat, 'city', 1920, 1080, true);
    },
  },
};

export const onCommand = async ({ args, chat, button }: AppCtx): Promise<void> => {
  const { query, width, height } = parseArgs(args);

  const buttons = [
    button.generateID({ id: BUTTON_ID.random, public: true }),
    button.generateID({ id: BUTTON_ID.nature, public: true }),
    button.generateID({ id: BUTTON_ID.space, public: true }),
    button.generateID({ id: BUTTON_ID.city, public: true }),
  ];

  const loadingId = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: `🖼️ **Finding wallpaper...**\n🔎 Query: _${query || 'Random'}_ (${width}x${height})`,
    button: buttons,
  });

  try {
    let url: string;
    let sourceName: string;

    if (query) {
      url = `https://loremflickr.com/${width}/${height}/${encodeURIComponent(query)}/all`;
      sourceName = 'LoremFlickr';
    } else {
      url = `https://picsum.photos/${width}/${height}`;
      sourceName = 'Picsum';
    }

    const { data } = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT,
      maxRedirects: 5,
    });

    const caption =
      `🖼️ **Wallpaper Generated**\n` +
      `📐 **Size:** ${width}x${height}\n` +
      `🔎 **Topic:** ${query || 'Random'}\n` +
      `📷 **Source:** ${sourceName}`;

    if (loadingId) {
      await chat.unsendMessage(loadingId as string).catch(() => {});
    }

    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: caption,
      attachment: [{ name: `wallpaper_${width}x${height}.jpg`, stream: Buffer.from(data) }],
      button: buttons,
    });
  } catch (err) {
    const error = err as { message?: string; response?: { status?: number } };
    let errorMsg = `⚠️ **Generation Failed**\n\`${error.message ?? 'Unknown error'}\``;

    if (error.response?.status === 404) {
      errorMsg = `⚠️ **Not Found**\nCould not find a wallpaper for "_${query}_". Try a simpler term.`;
    }

    if (loadingId) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: loadingId as string,
        message: errorMsg,
      });
    } else {
      await chat.replyMessage({ style: MessageStyle.MARKDOWN, message: errorMsg });
    }
  }
};