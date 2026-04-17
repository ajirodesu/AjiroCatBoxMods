/**
 * Spotify / Shazam Command
 * Search for a song and get its details and preview.
 */

import type { AppCtx } from '@/engine/types/controller.types.js';
import { Role } from '@/engine/constants/role.constants.js';
import { MessageStyle } from '@/engine/constants/message-style.constants.js';

export const config = {
  name: 'spotify',
  aliases: ['sp', 'music', 'shazam'] as string[],
  version: '1.0.0',
  role: Role.ANYONE,
  author: 'AjiroDesu',
  description: 'Search for a song and get its details and preview.',
  category: 'Media',
  usage: '<song title>',
  cooldown: 5,
  hasPrefix: true,
};

interface ShazamSong {
  title: string;
  artistName: string;
  albumName: string;
  genreNames?: string[];
  durationInMillis?: number;
  releaseDate?: string;
  thumbnail?: string;
  appleMusicUrl?: string;
  previewUrl?: string;
}

interface ShazamResponse {
  results?: ShazamSong[];
}

export const onCommand = async ({ args, chat }: AppCtx): Promise<void> => {
  if (!args.length) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: '❌ Please provide a song title.\nUsage: `/spotify <song title>`',
    });
    return;
  }

  const title = args.join(' ');

  let data: ShazamResponse;
  try {
    const url = `https://betadash-api-swordslush-production.up.railway.app/shazam?title=${encodeURIComponent(title)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API responded with status ${res.status}`);
    data = (await res.json()) as ShazamResponse;
  } catch (err) {
    const error = err as { message?: string };
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `❌ Failed to reach the music API.\n\`${error.message ?? 'Unknown error'}\``,
    });
    return;
  }

  if (!data?.results?.length) {
    await chat.replyMessage({
      style: MessageStyle.MARKDOWN,
      message: `🔍 No results found for **${title}**.`,
    });
    return;
  }

  const song = data.results[0]!;

  const duration = song.durationInMillis
    ? (() => {
        const totalSec = Math.floor(song.durationInMillis! / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
      })()
    : 'N/A';

  const releaseYear = song.releaseDate
    ? new Date(song.releaseDate).getFullYear()
    : 'N/A';

  const genres = song.genreNames?.filter((g) => g !== 'Music').join(', ') || 'N/A';

  const caption =
    `🎵 **${song.title}**\n` +
    `👤 Artist: ${song.artistName}\n` +
    `💿 Album: ${song.albumName}\n` +
    `🎭 Genre: ${genres}\n` +
    `⏱ Duration: ${duration}\n` +
    `📅 Released: ${releaseYear}`;

  // Send album art with song details
  if (song.thumbnail) {
    try {
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: caption,
        attachment_url: [{ name: 'album_art.jpg', url: song.thumbnail }],
      });
    } catch {
      await chat.replyMessage({ style: MessageStyle.MARKDOWN, message: caption });
    }
  } else {
    await chat.replyMessage({ style: MessageStyle.MARKDOWN, message: caption });
  }

  // Fetch and send preview as an MP3 file
  if (song.previewUrl) {
    try {
      const audioRes = await fetch(song.previewUrl);
      if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
      const arrayBuffer = await audioRes.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      const fileName = `${song.title} - ${song.artistName}.mp3`.replace(
        /[/\\?%*:|"<>]/g,
        '-',
      );

      await chat.reply({
        style: MessageStyle.MARKDOWN,
        message: `🎵 ${song.title} — ${song.artistName}`,
        attachment: [{ name: fileName, stream: audioBuffer }],
      });
    } catch (err) {
      const error = err as { message?: string };
      await chat.replyMessage({
        style: MessageStyle.MARKDOWN,
        message: `⚠️ Could not send audio preview.\n\`${error.message ?? 'Unknown error'}\``,
      });
    }
  }
};
