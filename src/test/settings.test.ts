import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { testDb } from "./setup.js";
import { users, workspaces } from "../db/schema.js";

describe("Settings API", () => {
  let workspaceId: number;

  beforeEach(async () => {
    const user = testDb.insert(users).values({
      username: "testuser",
      passwordHash: "hashedpassword",
    }).returning().get();

    const workspace = testDb.insert(workspaces).values({
      name: "Test Workspace",
      ownerId: user.id,
    }).returning().get();

    workspaceId = workspace.id;
  });

  describe("GET /api/settings", () => {
    it("returns default settings initially", async () => {
      const res = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        discord_client_id: "",
        discord_client_secret: "",
        check_interval_minutes: 10,
      });
    });
  });

  describe("PUT /api/settings", () => {
    it("saves discord client id", async () => {
      const res = await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          discord_client_id: "123456789",
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const getRes = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      expect(getRes.body.discord_client_id).toBe("123456789");
    });

    it("saves discord client secret and masks it on read", async () => {
      const res = await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          discord_client_secret: "super-secret-key",
        });
      
      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });

    it("does not update secret when masked value is sent", async () => {
      await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          discord_client_secret: "original-secret",
        });

      await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          discord_client_id: "new-id",
          discord_client_secret: "••••••••",
        });

      const getRes = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      expect(getRes.body.discord_client_id).toBe("new-id");
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });

    it("saves both client id and secret", async () => {
      const res = await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          discord_client_id: "my-client-id",
          discord_client_secret: "my-client-secret",
        });
      
      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      expect(getRes.body.discord_client_id).toBe("my-client-id");
      expect(getRes.body.discord_client_secret).toBe("••••••••");
    });

    it("saves check interval", async () => {
      const res = await request(app)
        .put(`/api/settings?workspaceId=${workspaceId}`)
        .send({
          check_interval_minutes: 30,
        });
      
      expect(res.status).toBe(200);

      const getRes = await request(app).get(`/api/settings?workspaceId=${workspaceId}`);
      expect(getRes.body.check_interval_minutes).toBe(30);
    });
  });
});
