/**
 * Detect Command
 * Passively detects keywords and notifies bot admins.
 * onCommand: BOT_ADMIN only status check.
 * onChat: passive listener, open to all messages.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';

export const config = {
  name: 'detect',
  aliases: [] as string[],
  version: '1.1.0',
  role: Role.BOT_ADMIN,
  author: 'AjiroDesu',
  description: 'Passively detects keywords and notifies bot admins.',
  category: 'Hidden',
  usage: '',
  cooldown: 0,
  hasPrefix: true,
};

// ── Keywords to watch ─────────────────────────────────────────────────────────

const KEYWORDS = ['lance'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Escape MarkdownV2 special characters so raw user text never breaks
 * the bot's formatted alert message.
 */
function escapeMd(text: string): string {
  return String(text ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Build a whole-word, case-insensitive RegExp for a keyword.
 * Falls back to null if the keyword contains characters that break the regex.
 */
function makePattern(kw: string): RegExp | null {
  try {
    return new RegExp(`\\b${kw}\\b`, 'i');
  } catch {
    return null;
  }
}

// Build patterns once at module load
const PATTERNS: Record<string, RegExp | null> = Object.fromEntries(
  KEYWORDS.map((kw) => [kw, makePattern(kw)]),
);

// ── onCommand — admin status check ───────────────────────────────────────────

export const onCommand = async ({ chat }: AppCtx): Promise<void> => {
  await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message:
      `🛡️ **Detection System Online**\n` +
      `Watching for: _${KEYWORDS.map(escapeMd).join(', ')}_`,
  });
};

// ── onChat — passive keyword scanner ─────────────────────────────────────────

export const onChat = async ({ event, chat }: AppCtx): Promise<void> => {
  const message = event['message'] as string | undefined;
  if (!message) return;

  // Skip messages from bots — avoids bot-to-bot feedback loops
  const from = event['senderID'] as string | undefined;
  if (!from) return;

  // Find every keyword that appears in the message
  const detected = KEYWORDS.filter((kw) => {
    const pattern = PATTERNS[kw];
    return pattern
      ? pattern.test(message)
      : message.toLowerCase().includes(kw.toLowerCase());
  });

  if (!detected.length) return;

  // Build report metadata
  const threadID = event['threadID'] as string;
  const isGroup = event['isGroup'] as boolean | undefined;
  const senderID = event['senderID'] as string;
  const messageID = event['messageID'] as string | undefined;

  const chatLabel = isGroup ? `Group \`${threadID}\`` : `Private Chat \`${threadID}\``;
  const keywords = detected.map((k) => `\`${k}\``).join(', ');
  const safeBody = escapeMd(message);

  const report =
    `🚨 *Keyword Detected: ${keywords}*\n\n` +
    `*Chat Details:*\n` +
    `• Type: ${chatLabel}\n\n` +
    `*User Details:*\n` +
    `• User ID: \`${senderID}\`\n\n` +
    `*Message Details:*\n` +
    `• Message ID: \`${messageID ?? 'N/A'}\`\n` +
    `• Content:\n\n` +
    `_${safeBody}_`;

  // Send alert to the developer's own thread using chat.reply with thread_id override.
  // We reuse chat because we captured the threadID from the event for targeting.
  // In practice each deployer should configure their own dev thread ID here.
  try {
    await chat.reply({
      thread_id: threadID,
      style: MessageStyle.MARKDOWN,
      message: report,
    });
  } catch (err) {
    console.error('[detect] Failed to send alert:', (err as Error).message);
  }
};
