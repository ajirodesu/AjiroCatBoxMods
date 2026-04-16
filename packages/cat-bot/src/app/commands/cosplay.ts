/**
 * /cosplay — Random Cosplay Video
 *
 * Fetches a random cosplay .mp4 from the ajirodesu/cosplay GitHub archive
 * and sends it as a video with a persistent "🔁 Next Video" button.
 *
 * Flow:
 *   User: /cosplay
 *   Bot:  [video with caption + 🔁 Next Video button]
 *   User: [clicks 🔁 Next Video]
 *   Bot:  [edits the same message with a new video — button stays]
 *
 * How the button persists:
 *   - onCommand checks event['type']. If 'button_action', it calls chat.editMessage()
 *     with the same session.id so the existing button is reused in-place.
 *   - If it is a fresh /cosplay invocation, a new buttonId is generated and
 *     chat.replyMessage() sends the video as a new message.
 *
 * Platform notes:
 *   Discord      — video sent as attachment; button appears as a component below.
 *   Telegram     — video sent via attachment_url; inline keyboard shown below.
 *   Facebook Page — attachment_url video; button rendered as Button Template.
 *   hasNativeButtons() guards platforms that do not support interactive buttons.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';

// ── Video Fetcher ─────────────────────────────────────────────────────────────

/**
 * Scrapes the ajirodesu/cosplay GitHub tree for .mp4 file paths and returns
 * a raw.githubusercontent.com URL for a randomly selected video.
 *
 * Returns null on any error so callers can surface a clean error message.
 */
async function fetchCosplayVideo(): Promise<string | null> {
  try {
    const repoUrl = 'https://github.com/ajirodesu/cosplay/tree/main/';
    const { data: html } = await axios.get<string>(repoUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Cat-Bot/1.0)' },
    });

    // GitHub renders file entries as anchor hrefs — match only .mp4 blobs
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cosplay] fetchCosplayVideo error:', msg);
    return null;
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

export const config = {
  name: 'cosplay',
  aliases: ['cs'] as string[],
  version: '1.1.0',
  role: Role.ANYONE,
  author: 'AjiroDesu (ported to Cat-Bot)',
  description: 'Get a random cosplay video from the archive.',
  category: 'Random',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

// ── Button Definition ─────────────────────────────────────────────────────────

const BUTTON_ID = { next: 'next' } as const;

/**
 * Button definitions exported as `button`.
 * The onClick simply re-invokes onCommand so the existing message is replaced
 * with a new video without cluttering the chat with extra messages.
 */
export const button = {
  [BUTTON_ID.next]: {
    label: '🔁 Next Video',
    style: ButtonStyle.PRIMARY,
    onClick: async (ctx: AppCtx) => onCommand(ctx),
  },
};

// ── Command Entry Point ───────────────────────────────────────────────────────

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  const { chat, native, event, button, session } = ctx;

  try {
    const videoUrl = await fetchCosplayVideo();

    if (!videoUrl) {
      const errPayload = {
        style: MessageStyle.MARKDOWN,
        message: '⚠️ **No videos found.** The archive may be temporarily unavailable. Please try again.',
      };
      if (event['type'] === 'button_action') {
        await chat.editMessage({
          ...errPayload,
          message_id_to_edit: event['messageID'] as string,
        });
      } else {
        await chat.replyMessage(errPayload);
      }
      return;
    }

    // Reuse the active instance ID when refreshing via button so the button
    // slot is updated in-place and never disappears between clicks.
    const buttonId =
      event['type'] === 'button_action'
        ? session.id
        : button.generateID({ id: BUTTON_ID.next, public: true });

    // Edit the existing message when triggered by the button; send fresh otherwise
    if (event['type'] === 'button_action') {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message: '👗 **Random Cosplay**',
        attachment_url: [{ name: 'cosplay.mp4', url: videoUrl }],
        message_id_to_edit: event['messageID'] as string,
        ...(hasNativeButtons(native.platform) ? { button: [buttonId] } : {}),
      });
    } else {
      // reply_to_message_id threads the bot's video under the user's command message on Telegram.
      // Other platforms that don't support threaded replies silently ignore the field.
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: '👗 **Random Cosplay**',
        attachment_url: [{ name: 'cosplay.mp4', url: videoUrl }],
        reply_to_message_id: event['messageID'] as string,
        ...(hasNativeButtons(native.platform) ? { button: [buttonId] } : {}),
      });
    }
  } catch {
    const errPayload = {
      style: MessageStyle.MARKDOWN,
      message: '⚠️ **Error:** Failed to fetch a cosplay video. Please try again later.',
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