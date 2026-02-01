import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("Settings API", () => {
  describe("GET /api/settings", () => {
    it("returns empty settings initially", async () => {
      const res = await request(app).get("/api/settings");
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    });
  });

  describe("PUT /api/settings", () => {
    it("saves discord client id", async () => {
      const res = await request(app)
        .put("/api/settings")
        .send({
          discord_client_id: "123456789",
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const getRes = await request(app).get("/api/settings");
      expect(getRes.body.discord_client_id).toBe("123456789");
    });

    it("saves discord client secret and masks it on read", async () => {
      const res = await request(app)
        .put("/api/settings")
        .send({
          discord_client_secret: "super-secret-key",
        });
      
      expect(res.status).toBe(200);

      const getRes = await request(app).get("/api/settings");
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });

    it("does not update secret when masked value is sent", async () => {
      await request(app)
        .put("/api/settings")
        .send({
          discord_client_secret: "original-secret",
        });

      await request(app)
        .put("/api/settings")
        .send({
          discord_client_id: "new-id",
          discord_client_secret: "••••••••",
        });

      const getRes = await request(app).get("/api/settings");
      expect(getRes.body.discord_client_id).toBe("new-id");
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });

    it("saves both client id and secret", async () => {
      const res = await request(app)
        .put("/api/settings")
        .send({
          discord_client_id: "my-client-id",
          discord_client_secret: "my-client-secret",
        });
      
      expect(res.status).toBe(200);

      const getRes = await request(app).get("/api/settings");
      expect(getRes.body.discord_client_id).toBe("my-client-id");
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });
  });
});
