const EMOJI_API_URL =
  import.meta.env.VITE_EMOJI_API_URL ?? '/api/index';

type EmojiResponse = {
  message?: string;
  emoji?: string;
};

export async function fetchRandomEmoji(): Promise<string> {
  const response = await fetch(EMOJI_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch emoji (${response.status})`);
  }

  const data = (await response.json()) as EmojiResponse;
  const emoji = data.message ?? data.emoji;

  if (!emoji) {
    throw new Error('Backend did not return an emoji');
  }

  return emoji;
}
