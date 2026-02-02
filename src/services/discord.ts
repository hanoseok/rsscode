interface RssItemData {
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
  categories?: string;
}

interface DiscordMessage {
  webhookUrl: string;
  feedName: string;
  profileImage?: string | null;
  messageTemplate?: string | null;
  rssItem: RssItemData;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function applyTemplate(template: string, item: RssItemData): string {
  let result = template;

  const fieldMap: Record<string, string> = {
    title: item.title || "",
    link: item.link || "",
    description: item.description || "",
    content: item.content || "",
    pubDate: item.pubDate || "",
    isoDate: item.isoDate || "",
    author: item.author || "",
    categories: item.categories || "",
  };

  result = result.replace(/\{(\w+):(\d+)\}/g, (_match, field, limit) => {
    const value = fieldMap[field] || "";
    return truncate(value, parseInt(limit, 10));
  });

  result = result.replace(/\{(\w+)\}/g, (_match, field) => {
    const value = fieldMap[field] || "";
    if (field === "link") return value;
    return truncate(value, 500);
  });

  return result.trim();
}

export async function sendToDiscord(message: DiscordMessage): Promise<boolean> {
  const { rssItem, messageTemplate } = message;
  const defaultTemplate = "{title}\n{link}";
  const template = messageTemplate || defaultTemplate;
  const content = applyTemplate(template, rssItem);

  const payload = {
    username: message.feedName,
    avatar_url: message.profileImage || undefined,
    content,
  };

  try {
    const response = await fetch(message.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Discord webhook failed: ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send to Discord:", error);
    return false;
  }
}

export { applyTemplate };
export type { RssItemData };
