/**
 * /cosplay — Random Cosplay Video
 *
 * Fetches a random cosplay .mp4 from the ajirodesu/cosplay GitHub archive.
 * Implements a "Next Video" button that replaces the current video in-place
 * by re-invoking onCommand with the existing message ID.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches a random .mp4 URL from the ajirodesu/cosplay GitHub repository.
 * Scrapes the GitHub tree page and returns a raw.githubusercontent.com URL.
 */
async function fetchCosplayVideo(): Promise<string | null> {
  try {
    const repoUrl = 'https://github.com/ajirodesu/cosplay/tree/main/';
    const { data: html } = await axios.get<string>(repoUrl, { timeout: 8000 });

    const re = /href="\/ajirodesu\/cosplay\/blob\/main\/([^"]+\.mp4)"/g;
    const files: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[1]) files.push(m[1]);
    }

    if (!files.length) return null;

    const file = files[Math.floor(Math.random() * files.length)];
    return `https://raw.githubusercontent.com/ajirodesu/cosplay/main/${file}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Cosplay] Fetch error:', message);
    return null;
  }
}

// ── Command Config ────────────────────────────────────────────────────────────

export const config = {
  name: 'cosplay',
  aliases: [] as string[],
  version: '1.1.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Get a random cosplay video from the archive.',
  category: 'Random',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

// ── Button Registry ───────────────────────────────────────────────────────────

const BUTTON_ID = { next: 'next' } as const;

export const button = {
  [BUTTON_ID.next]: {
    label: '🔁 Next Video',
    style: ButtonStyle.PRIMARY,
    // Re-invoke onCommand so the refresh replaces the current video via editMessage
    onClick: async (ctx: AppCtx) => onCommand(ctx),
  },
};

// ── Command Handler ───────────────────────────────────────────────────────────

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  const { chat, native, event, button: btn } = ctx;

  const isButtonAction = event['type'] === 'button_action';

  try {
    const videoUrl = await fetchCosplayVideo();
    if (!videoUrl) throw new Error('No videos found in archive.');

    // Reuse active button session ID on refresh; generate a new one on fresh command
    const buttonId = isButtonAction
      ? ctx.session.id
      : btn.generateID({ id: BUTTON_ID.next, public: true });

    const payload = {
      style: MessageStyle.MARKDOWN,
      message: '👗 **Random Cosplay**',
      attachment_url: [{ name: 'cosplay.mp4', url: videoUrl }],
      ...(hasNativeButtons(native.platform) ? { button: [buttonId] } : {}),
    };

    if (isButtonAction) {
      await chat.editMessage({
        ...payload,
        message_id_to_edit: event['messageID'] as string,
      });
    } else {
      await chat.replyMessage(payload);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const errPayload = {
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${message}`,
    };

    if (isButtonAction) {
      await chat.editMessage({
        ...errPayload,
        message_id_to_edit: event['messageID'] as string,
      });
    } else {
      await chat.replyMessage(errPayload);
    }
  }
};