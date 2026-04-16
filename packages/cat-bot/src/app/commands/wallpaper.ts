/**
 * Wallpaper Command
 * Fetches high-quality wallpapers based on keywords or random generation.
 * Includes interactive topic buttons with row wrapping.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';

const TIMEOUT = 20000;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const BUTTONS_PER_ROW = 3;

function parseArgs(args: string[]): { query: string; width: number; height: number } {
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

const BUTTON_ID = {
  random: 'random',
  nature: 'nature',
  space: 'space',
  city: 'city',
  sunset: 'sunset',
  anime: 'anime',
} as const;

const PRESETS = {
  [BUTTON_ID.random]: { label: '🎲 Random', query: '' },
  [BUTTON_ID.nature]: { label: '🌿 Nature', query: 'nature' },
  [BUTTON_ID.space]: { label: '🌌 Space', query: 'space' },
  [BUTTON_ID.city]: { label: '🏙️ City', query: 'city' },
  [BUTTON_ID.sunset]: { label: '🌅 Sunset', query: 'sunset' },
  [BUTTON_ID.anime]: { label: '✨ Anime', query: 'anime' },
} as const;

export const config = {
  name: 'wallpaper',
  aliases: ['wp', 'wall', 'background'] as string[],
  version: '1.3.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Get a random wallpaper (optionally specify size/topic).',
  category: 'Utility',
  usage: '[query] [WxH]',
  cooldown: 5,
  hasPrefix: true,
};

function buildWallpaperButtons(button: AppCtx['button']) {
  const ids = [
    button.generateID({ id: BUTTON_ID.random, public: true }),
    button.generateID({ id: BUTTON_ID.nature, public: true }),
    button.generateID({ id: BUTTON_ID.space, public: true }),
    button.generateID({ id: BUTTON_ID.city, public: true }),
    button.generateID({ id: BUTTON_ID.sunset, public: true }),
    button.generateID({ id: BUTTON_ID.anime, public: true }),
  ];

  return chunkArray(ids, BUTTONS_PER_ROW);
}

async function renderWallpaper(ctx: AppCtx, query: string, width: number, height: number): Promise<void> {
  const { chat, event, native, button } = ctx;
  const isButtonAction = event['type'] === 'button_action';
  const buttons = buildWallpaperButtons(button);

  const loadingMessage = {
    style: MessageStyle.MARKDOWN,
    message: `🖼️ **Finding wallpaper...**\n🔎 Query: _${query || 'Random'}_ (${width}x${height})`,
  };

  let loadingId: string | undefined;

  if (!isButtonAction) {
    loadingId = (await chat.replyMessage(loadingMessage)) as string | undefined;
  }

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

    const payload = {
      style: MessageStyle.MARKDOWN,
      message: caption,
      attachment: [{ name: `wallpaper_${width}x${height}.jpg`, stream: Buffer.from(data) }],
      ...(hasNativeButtons(native.platform) ? { button: buttons as any } : {}),
    };

    if (isButtonAction) {
      await chat.editMessage({
        ...payload,
        message_id_to_edit: event['messageID'] as string,
      });
      return;
    }

    if (loadingId) {
      await chat.unsendMessage(loadingId).catch(() => {});
    }

    await chat.replyMessage(payload);
  } catch (err) {
    const error = err as { message?: string; response?: { status?: number } };
    let errorMsg = `⚠️ **Generation Failed**\n\`${error.message ?? 'Unknown error'}\``;

    if (error.response?.status === 404) {
      errorMsg = `⚠️ **Not Found**\nCould not find a wallpaper for "_${query}_". Try a simpler term.`;
    }

    if (isButtonAction) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: event['messageID'] as string,
        message: errorMsg,
        ...(hasNativeButtons(native.platform) ? { button: buttons as any } : {}),
      });
      return;
    }

    if (loadingId) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: loadingId,
        message: errorMsg,
      });
    } else {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: errorMsg,
      });
    }
  }
}

export const button = {
  [BUTTON_ID.random]: {
    label: PRESETS[BUTTON_ID.random].label,
    style: ButtonStyle.PRIMARY,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.random].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },

  [BUTTON_ID.nature]: {
    label: PRESETS[BUTTON_ID.nature].label,
    style: ButtonStyle.SECONDARY,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.nature].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },

  [BUTTON_ID.space]: {
    label: PRESETS[BUTTON_ID.space].label,
    style: ButtonStyle.SUCCESS,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.space].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },

  [BUTTON_ID.city]: {
    label: PRESETS[BUTTON_ID.city].label,
    style: ButtonStyle.DANGER,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.city].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },

  [BUTTON_ID.sunset]: {
    label: PRESETS[BUTTON_ID.sunset].label,
    style: ButtonStyle.PRIMARY,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.sunset].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },

  [BUTTON_ID.anime]: {
    label: PRESETS[BUTTON_ID.anime].label,
    style: ButtonStyle.SECONDARY,
    onClick: async (ctx: AppCtx) => {
      await renderWallpaper(ctx, PRESETS[BUTTON_ID.anime].query, DEFAULT_WIDTH, DEFAULT_HEIGHT);
    },
  },
};

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  const { args } = ctx;
  const { query, width, height } = parseArgs(args);

  await renderWallpaper(ctx, query, width, height);
};