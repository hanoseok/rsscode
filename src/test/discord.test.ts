import { describe, it, expect } from "vitest";
import { sendToDiscord } from "../services/discord.js";

describe("Discord Service", () => {
  describe("sendToDiscord", () => {
    it("returns false when webhook URL is invalid", async () => {
      const result = await sendToDiscord({
        webhookUrl: "not-a-valid-url",
        feedName: "Test Feed",
        rssItem: {
          title: "Test Title",
          link: "https://example.com",
        },
      });
      
      expect(result).toBe(false);
    });

    it("returns false when webhook URL returns error", async () => {
      const result = await sendToDiscord({
        webhookUrl: "https://httpstat.us/500",
        feedName: "Test Feed",
        rssItem: {
          title: "Test Title",
          link: "https://example.com",
        },
      });
      
      expect(result).toBe(false);
    });
  });
});
