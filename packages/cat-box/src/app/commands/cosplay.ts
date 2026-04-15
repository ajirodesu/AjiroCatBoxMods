/**
 * /cosplay — Random Cosplay Video
 *
 * Fetches a random cosplay video from the GitHub archive (ajirodesu/cosplay).
 * Includes a "Next Video" button that re-fetches a new random video in-place.
 *
 * How it works:
 *   1. onCommand calls chat.reply() with the generated button ID.
 *   2. The button system prefixes the ID and registers the handler.
 *   3. When clicked, the platform emits 'button_action' → button["next"].onClick(ctx) is called.
 *   4. onClick re-fetches and edits the message (with the button re-attached so it can be used again).
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetches a random cosplay video URL by scraping the GitHub repo file list. */
async function fetchCosplayVideo(): Promise<string | null> {
  try {
    const repoUrl = 'https://github.com/ajirodesu/cosplay/tree/main/';
    const { data: html } = await axios.get(repoUrl, { timeout: 8000 });

    // Regex to find .mp4 files in GitHub file list
    const re = /href="\/ajirodesu\/cosplay\/blob\/main\/([^"]+\.mp4)"/g;
    const files: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = re.exec(html)) !== null) {
      if (match[1]) files.push(match[1]);
    }

    if (!files.length) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    return `https://raw.githubusercontent.com/ajirodesu/cosplay/main/${file}`;
  } catch {
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

// BUTTON_IDs are the local keys used in the button object.
// The engine automatically prefixes them with the command name at dispatch time.
const BUTTON_ID = {
  next: 'next',
};

/**
 * Button definitions exported as `button`.
 * Keys match BUTTON_ID values. `onClick` receives the same ctx shape as `onCommand`.
 */
export const button = {
  [BUTTON_ID.next]: {
    label: '🔁 Next Video',
    style: ButtonStyle.PRIMARY,
    onClick: async ({ chat, event, button }: AppCtx) => {
      try {
        const videoUrl = await fetchCosplayVideo();
        if (!videoUrl) throw new Error('No videos found.');

        // Derive file extension from URL for a clean attachment name
        const extMatch = videoUrl.match(/\.(jpe?g|png|gif|webp|mp4)(\?|$)/i);
        const ext = extMatch?.[1] ?? 'mp4';

        await chat.editMessage({
          style: MessageStyle.MARKDOWN,
          message_id_to_edit: event['messageID'] as string,
          message: '👗 **Random Cosplay**',
          attachment_url: [{ name: `cosplay.${ext}`, url: videoUrl }],
          button: [
            button.generateID({ id: BUTTON_ID.next, public: true }),
          ],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await chat.editMessage({
          style: MessageStyle.MARKDOWN,
          message_id_to_edit: event['messageID'] as string,
          message: `⚠️ **Error:** ${message}`,
        });
      }
    },
  },
};

/**
 * Entry point: fetches the first video and sends it with the interactive button.
 */
export const onCommand = async ({ chat, button }: AppCtx) => {
  try {
    const videoUrl = await fetchCosplayVideo();
    if (!videoUrl) throw new Error('No videos found.');

    // Derive file extension from URL for a clean attachment name
    const extMatch = videoUrl.match(/\.(jpe?g|png|gif|webp|mp4)(\?|$)/i);
    const ext = extMatch?.[1] ?? 'mp4';

    await chat.reply({
      style: MessageStyle.MARKDOWN,
      message: '👗 **Random Cosplay**',
      attachment_url: [{ name: `cosplay.${ext}`, url: videoUrl }],
      button: [
        button.generateID({ id: BUTTON_ID.next, public: true }),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await chat.reply({
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${message}`,
    });
  }
};