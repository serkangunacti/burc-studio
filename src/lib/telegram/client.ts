type Fetch = typeof fetch;

export type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type InlineKeyboard = InlineButton[][];

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TelegramError';
  }
}

export type TelegramClient = ReturnType<typeof createTelegramClient>;

export function createTelegramClient(token: string, fetchImpl: Fetch = fetch) {
  async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!body.ok) throw new TelegramError(`Telegram ${method}: ${body.description ?? response.status}`, response.status);
    return body.result as T;
  }
  const markup = (keyboard?: InlineKeyboard) => (keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {});

  return {
    getMe: () => call<{ id: number; username: string }>('getMe', {}),
    setWebhook: (url: string, secret: string) =>
      call<boolean>('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }),
    sendMessage: (chatId: number, html: string, options: { keyboard?: InlineKeyboard; silent?: boolean } = {}) =>
      call<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        disable_notification: options.silent ?? false,
        ...markup(options.keyboard),
      }),
    editMessage: (chatId: number, messageId: number, html: string, keyboard?: InlineKeyboard) =>
      call<unknown>('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: html,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: keyboard ?? [] },
      }),
    sendPhotos: (chatId: number, urls: string[]) =>
      call<unknown>('sendMediaGroup', { chat_id: chatId, media: urls.map((url) => ({ type: 'photo', media: url })), disable_notification: true }),
    answerCallback: (callbackId: string, text?: string) => call<boolean>('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) }),
  };
}

export function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
