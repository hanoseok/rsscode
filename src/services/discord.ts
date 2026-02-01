interface DiscordMessage {
  webhookUrl: string;
  feedName: string;
  profileImage?: string | null;
  title: string;
  link: string;
}

export async function sendToDiscord(message: DiscordMessage): Promise<boolean> {
  const payload = {
    username: message.feedName,
    avatar_url: message.profileImage || undefined,
    embeds: [
      {
        title: message.title,
        url: message.link,
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
      },
    ],
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
