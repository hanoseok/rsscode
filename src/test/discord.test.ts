import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendToDiscord } from "../services/discord.js";

describe("Discord Service", () => {
  describe("sendToDiscord", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

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

    it("returns false when webhook returns a non-2xx status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("server error", { status: 500 }),
      );

      const result = await sendToDiscord({
        webhookUrl: "https://example.com/webhook",
        feedName: "Test Feed",
        rssItem: {
          title: "Test Title",
          link: "https://example.com",
        },
      });

      expect(result).toBe(false);
    });

    it("returns true when webhook returns 2xx", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      const result = await sendToDiscord({
        webhookUrl: "https://example.com/webhook",
        feedName: "Test Feed",
        rssItem: {
          title: "Test Title",
          link: "https://example.com",
        },
      });

      expect(result).toBe(true);
    });
  });
});
