/**
 * cosplay.ts — Random cosplay video command
 *
 * Scrapes .mp4 filenames from the ajirodesu/cosplay GitHub archive and
 * streams a randomly-selected video into chat.  Costs COST coins per use,
 * including the "Next Video" button.
 *
 * Coin schema (bot_users_session.data → "money" key):
 *   { coins: number }   — written by /daily; read + decremented here.
 */

import axios from 'axios';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';
import { ButtonStyle } from '@/engine/constants/button-style.constants.js';
import { hasNativeButtons } from '@/engine/utils/ui-capabilities.util.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const COST = 100;

// ─── Config ───────────────────────────────────────────────────────────────────

export const config = {
  name: 'cosplay',
  aliases: [] as string[],
  version: '2.1.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: `Get a random cosplay video from the archive. Costs 💰${COST} coins per use.`,
  category: 'Random',
  usage: '',
  cooldown: 5,
  hasPrefix: true,
};

// ─── Video fetcher ────────────────────────────────────────────────────────────

/**
 * Scrapes the GitHub tree page for the ajirodesu/cosplay repo and returns
 * a raw-content URL for a randomly-chosen .mp4 file.
 */
async function fetchCosplayVideo(): Promise<string> {
  const { data: html } = await axios.get(
    'https://github.com/ajirodesu/cosplay/tree/main/',
    { timeout: 8000 },
  );

  const re = /href="\/ajirodesu\/cosplay\/blob\/main\/([^"]+\.mp4)"/g;
  const files: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html as string)) !== null) files.push(m[1]!);

  if (!files.length) throw new Error('No videos found in archive.');

  const file = files[Math.floor(Math.random() * files.length)]!;
  return `https://raw.githubusercontent.com/ajirodesu/cosplay/main/${file}`;
}

// ─── Coin helpers ─────────────────────────────────────────────────────────────

/**
 * Reads the user's coin balance from the "money" collection.
 * Returns undefined when the collection has never been created (user
 * has not yet claimed /daily).
 */
async function getCoins(
  db: AppCtx['db'],
  senderID: string,
): Promise<number | undefined> {
  const userColl = db.users.collection(senderID);
  if (!(await userColl.isCollectionExist('money'))) return undefined;
  const money = await userColl.getCollection('money');
  return ((await money.get('coins')) as number | undefined) ?? 0;
}

/**
 * Attempts to deduct COST coins from the user's balance.
 *
 * Return shape:
 *   { ok: true,  balance: newBalance }  — deduction succeeded
 *   { ok: false, balance: undefined  }  — user has no money collection yet
 *   { ok: false, balance: number     }  — insufficient funds
 */
async function chargeUser(
  db: AppCtx['db'],
  senderID: string,
): Promise<{ ok: boolean; balance?: number }> {
  const coins = await getCoins(db, senderID);

  // No collection → user has never claimed /daily
  if (coins === undefined) return { ok: false, balance: undefined };
  if (coins < COST) return { ok: false, balance: coins };

  const userColl = db.users.collection(senderID);
  const money = await userColl.getCollection('money');
  await money.increment('coins', -COST);

  return { ok: true, balance: coins - COST };
}

// ─── Shared send helper ───────────────────────────────────────────────────────

/**
 * Fetches a video and sends / edits the message in place.
 * Used by both onCommand (send) and the button handler (edit).
 */
async function sendCosplayVideo(ctx: AppCtx): Promise<void> {
  const { chat, event, native, button } = ctx;

  const isButton = event['type'] === 'button_action';
  const messageID = event['messageID'] as string | undefined;

  // Reuse the existing button session ID on refresh; generate a fresh one on
  // a new command so the next-video button is correctly scoped.
  const nextBtnId = isButton
    ? ctx.session.id
    : button.generateID({ id: BUTTON_ID.next, public: true });

  const buttons = hasNativeButtons(native.platform) ? { button: [nextBtnId] } : {};

  try {
    const videoUrl = await fetchCosplayVideo();

    // Derive a safe filename from the URL tail (keeps the original name for
    // MIME resolution by the platform wrapper).
    const fileName = videoUrl.split('/').pop() ?? 'cosplay.mp4';

    const payload = {
      style: MessageStyle.MARKDOWN,
      message: '👗 **Random Cosplay**',
      attachment_url: [{ name: fileName, url: videoUrl }],
      ...buttons,
    };

    if (isButton && messageID) {
      await chat.editMessage({ ...payload, message_id_to_edit: messageID });
    } else {
      await chat.replyMessage(payload);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const errPayload = {
      style: MessageStyle.MARKDOWN,
      message: `⚠️ **Error:** ${msg}`,
    };

    if (isButton && messageID) {
      await chat.editMessage({ ...errPayload, message_id_to_edit: messageID });
    } else {
      await chat.replyMessage(errPayload);
    }
  }
}

// ─── Button ───────────────────────────────────────────────────────────────────

const BUTTON_ID = { next: 'next' } as const;

export const button = {
  [BUTTON_ID.next]: {
    label: `🔁 Next Video  (-💰${COST})`,
    style: ButtonStyle.PRIMARY,

    onClick: async (ctx: AppCtx): Promise<void> => {
      const { chat, event, db, native } = ctx;
      const senderID = event['senderID'] as string | undefined;
      const messageID = event['messageID'] as string | undefined;

      if (!senderID) return;

      const { ok, balance } = await chargeUser(db, senderID);

      if (!ok) {
        const text =
          balance === undefined
            ? `🔴 No coins found — claim \`/daily\` first to earn coins.`
            : `💸 You need 💰 **${COST} coins** to load the next video.\nBalance: 💰 **${balance.toLocaleString()} coins**.`;

        // Re-show the button so the user can try again if they earn more coins
        const nextBtnId = ctx.session.id;
        const buttons = hasNativeButtons(native.platform)
          ? { button: [nextBtnId] }
          : {};

        await chat.editMessage({
          style: MessageStyle.MARKDOWN,
          message: text,
          message_id_to_edit: messageID ?? '',
          ...buttons,
        });
        return;
      }

      await sendCosplayVideo(ctx);
    },
  },
};

// ─── Command handler ──────────────────────────────────────────────────────────

export const onCommand = async (ctx: AppCtx): Promise<void> => {
  const { chat, event, db } = ctx;

  const senderID = event['senderID'] as string | undefined;
  if (!senderID) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '❌ Could not identify your user ID on this platform.',
    });
    return;
  }

  const { ok, balance } = await chargeUser(db, senderID);

  if (!ok) {
    const message =
      balance === undefined
        ? `🔴 No coins found — use \`/daily\` to earn your first coins before using this command.`
        : `💸 You need 💰 **${COST} coins** to use this command.\nYour balance: 💰 **${balance.toLocaleString()} coins**.`;

    await chat.replyMessage({ style: MessageStyle.MARKDOWN, message });
    return;
  }

  // Acknowledge the deduction immediately, then replace with the video
  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: `🔎 **Searching archives...** _(💰 ${COST} coins deducted)_`,
  });

  await sendCosplayVideo(ctx);
};