/**
 * /animeme — Random Anime Meme Generator
 *
 * Fetches a random anime meme directly from Reddit's r/animemes via the dedicated meme API.
 * Implements a "Next Meme" button to allow users to endlessly scroll fresh anime memes.
 *
 * ── Image Extraction Logic ───────────────────────────────────────────────────
 * The meme-api.com endpoint returns a clean post object with title and direct image URL.
 * No additional parsing or gallery handling is required.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';

async function fetchAnimeme() {
  try {
    const { data } = await axios.get('https://meme-api.com/gimme/animemes', {
      timeout: 10000,
    });

    if (!data?.url || !data?.title) {
      throw new Error('API returned no content.');
    }

    return {
      title: data.title as string,
      url: data.url as string,
      subreddit: (data.subreddit || 'animemes') as string,
      score: (data.ups as number) || 0,
    };
  } catch (_err) {
    throw new Error('Could not load anime meme from Reddit', { cause: _err });
  }
}

const BUTTON_ID = { next: 'next' } as const;

export const button = {
  [BUTTON_ID.next]: {
    label: '🔄 Next Meme',
    style: ButtonStyle.PRIMARY,
    // Re-invokes onCommand so the refresh replaces the current meme via editMessage, reducing chat clutter.
    onClick: async (ctx: AppCtx) => onCommand(ctx),
  },
};

export const config = {
  name: 'animeme',
  aliases: ['anime-meme'] as string[],
  version: '1.2.0',
  role: Role.ANYONE,
  author: 'ShawnDesu',
  description: 'Fetch a random anime meme from Reddit',
  category: 'Anime',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  const { chat, native, event, button, session } = ctx;

  try {
    const meme = await fetchAnimeme();

    // Isolate file extension to ensure proper MIME resolution during platform download
    const extMatch = meme.url.match(/\.(jpg|jpeg|png|gif)(\?|$)/i);
    const ext = extMatch ? extMatch[1] : 'jpg';

    // Reuse the active instance ID if triggered via button; generate a new one if fresh command
    const buttonId =
      event['type'] === 'button_action'
        ? session.id
        : button.generateID({ id: BUTTON_ID.next, public: true });

    const payload = {
      style: MessageStyle.MARKDOWN,
      message: [
        `**${meme.title || 'Untitled Anime Meme'}**`,
        `📍 r/${meme.subreddit}  |  👍 ${meme.score}`,
      ].join('\n'),
      attachment_url: [{ name: `animeme.${ext}`, url: meme.url }],
      ...(hasNativeButtons(native.platform) ? { button: [buttonId] } : {}),
    };

    // Update the existing message if triggered via button; otherwise send a new message
    if (event['type'] === 'button_action') {
      await chat.editMessage({
        ...payload,
        message_id_to_edit: event['messageID'] as string,
      });
    } else {
      await chat.replyMessage(payload);
    }
  } catch {
    const errPayload = {
      style: MessageStyle.MARKDOWN,
      message: '❌ Failed to fetch a fresh anime meme. Please try again later!',
    };
    if (event['type'] === 'button_action') {
      await chat.editMessage({
        ...errPayload,
        message_id_to_edit: event['messageID'] as string,
      });
    } else {
      await chat.replyMessage(errPayload);
    }
  }
};