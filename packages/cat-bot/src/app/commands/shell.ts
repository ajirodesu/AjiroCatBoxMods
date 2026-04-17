/**
 * Shell Command
 * Executes system shell commands. Developer only.
 */

import { exec as _exec } from 'child_process';
import { promisify } from 'util';
import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';

const exec = promisify(_exec);

export const config = {
  name: 'shell',
  aliases: ['sh', 'exec', 'term'] as string[],
  version: '1.0.0',
  role: Role.BOT_ADMIN,
  author: 'AjiroDesu',
  description: 'Execute shell/terminal commands.',
  category: 'Bot Admin',
  usage: '<command>',
  cooldown: 3,
  hasPrefix: true,
};

export const onCommand = async ({ args, chat, prefix = '/' }: AppCtx): Promise<void> => {
  if (!args.length) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `❌ Please provide a command to execute.\nUsage: \`${prefix}shell <command>\``,
    });
    return;
  }

  const command = args.join(' ');

  const loadingId = await chat.replyMessage({
    style: MessageStyle.MARKDOWN,
    message: '💻 **Executing...**',
  });

  try {
    const { stdout, stderr } = await exec(command, {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash',
    });

    const output = (stdout || '').toString().trim();
    const error = (stderr || '').toString().trim();

    let result = '';
    if (output) result += `STDOUT:\n${output}\n`;
    if (error) result += `STDERR:\n${error}\n`;
    if (!result) result = 'Command executed. No output.';

    // Handle large output — send as file
    if (result.length > 3000) {
      if (loadingId) {
        await chat.editMessage({
          style: MessageStyle.MARKDOWN,
          message_id_to_edit: loadingId as string,
          message: '📄 Output too large. Sending file...',
        });
      }
      await chat.reply({
        style: MessageStyle.MARKDOWN,
        message: '📄 **Shell Output**',
        attachment: [{ name: 'shell_output.txt', stream: Buffer.from(result, 'utf8') }],
      });
      return;
    }

    if (loadingId) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: loadingId as string,
        message: `\`\`\`bash\n${result}\n\`\`\``,
      });
    }
  } catch (err) {
    const error = err as { message?: string };
    const message = error.message ?? 'Unknown Error';

    if (loadingId) {
      await chat.editMessage({
        style: MessageStyle.MARKDOWN,
        message_id_to_edit: loadingId as string,
        message: `⚠️ **Execution Failed**\n\`\`\`\n${message}\n\`\`\``,
      });
    }
  }
};
