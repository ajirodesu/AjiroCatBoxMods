/**
 * /eval — JavaScript Evaluator (Developer Only)
 *
 * Executes arbitrary JavaScript code for debugging and testing.
 * Output is formatted as JSON when possible. If the result exceeds
 * the message limit it is sent as a downloadable file attachment.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';

export const config = {
  name: 'eval',
  aliases: ['e', 'run'] as string[],
  version: '1.0.0',
  role: Role.BOT_ADMIN,
  author: 'AjiroDesu',
  description: 'Evaluate JavaScript code (Developer Only)',
  category: 'Developer',
  usage: '<code to evaluate>',
  cooldown: 0,
  hasPrefix: true,
};

/** Converts a Map to a plain object for cleaner JSON serialization. */
function mapToObj(m: Map<unknown, unknown>): Record<string, unknown> {
  return Array.from(m).reduce<Record<string, unknown>>((obj, [key, value]) => {
    obj[String(key)] = value;
    return obj;
  }, {});
}

/** Serializes any value to a human-readable string. */
async function formatOutput(result: unknown): Promise<string> {
  if (result instanceof Promise) result = await result;
  if (typeof result === 'object' && result !== null) {
    if (result instanceof Map) result = mapToObj(result);
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

export const onCommand = async ({ chat, args }: AppCtx): Promise<void> => {
  if (!args.length) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '❌ Please provide code to evaluate.',
    });
    return;
  }

  const code = args.join(' ');

  // Send a loading message and capture its ID so we can edit it in place.
  const loadingId = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: '⚙️ **Compiling...**',
  });

  try {
    // Wrap in an async IIFE so top-level `await` works in the evaluated snippet.
    // eslint-disable-next-line no-eval
    const result = await eval(`(async () => { return ${code} })()`);
    const output = await formatOutput(result);

    // Platforms cap messages around 4 000 chars — send a file attachment for long output.
    if (output.length > 4000) {
      const buffer = Buffer.from(output, 'utf8');
      if (loadingId) await chat.unsendMessage(String(loadingId));
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: '✅ Output too long — sent as file.',
        attachment: [{ name: 'eval-output.json', stream: buffer }],
      });
      return;
    }

    await chat.editMessage({
      style: MessageStyle.MARKDOWN,
      message_id_to_edit: String(loadingId),
      message: `\`\`\`json\n${output}\n\`\`\``,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await chat.editMessage({
      style: MessageStyle.MARKDOWN,
      message_id_to_edit: String(loadingId),
      message: `❌ **Runtime Error:**\n\`${msg}\``,
    });
  }
};