import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("Feeds API", () => {
  describe("GET /api/feeds", () => {
    it("returns empty array when no feeds", async () => {
      const res = await request(app).get("/api/feeds");
      
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("POST /api/feeds", () => {
    it("creates a new feed", async () => {
      const res = await request(app)
        .post("/api/feeds")
        .send({
          name: "Test Feed",
          url: "https://example.com/feed.xml",
        });
      
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Test Feed");
      expect(res.body.url).toBe("https://example.com/feed.xml");
      expect(res.body.id).toBeDefined();
    });

    it("creates feed with profile image", async () => {
      const res = await request(app)
        .post("/api/feeds")
        .send({
          name: "Test Feed",
          url: "https://example.com/feed.xml",
          profileImage: "https://example.com/logo.png",
        });
      
      expect(res.status).toBe(201);
      expect(res.body.profileImage).toBe("https://example.com/logo.png");
    });

    it("returns 400 for invalid url", async () => {
      const res = await request(app)
        .post("/api/feeds")
        .send({
          name: "Test Feed",
          url: "not-a-url",
        });
      
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing name", async () => {
      const res = await request(app)
        .post("/api/feeds")
        .send({
          url: "https://example.com/feed.xml",
        });
      
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate url", async () => {
      await request(app)
        .post("/api/feeds")
        .send({
          name: "First Feed",
          url: "https://example.com/feed.xml",
        });

      const res = await request(app)
        .post("/api/feeds")
        .send({
          name: "Second Feed",
          url: "https://example.com/feed.xml",
        });
      
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/feeds/:id", () => {
    it("deletes an existing feed", async () => {
      const createRes = await request(app)
        .post("/api/feeds")
        .send({
          name: "Test Feed",
          url: "https://example.com/feed.xml",
        });

      const deleteRes = await request(app)
        .delete(`/api/feeds/${createRes.body.id}`);
      
      expect(deleteRes.status).toBe(204);

      const getRes = await request(app).get("/api/feeds");
      expect(getRes.body).toEqual([]);
    });

    it("returns 404 for non-existent feed", async () => {
      const res = await request(app).delete("/api/feeds/9999");
      
      expect(res.status).toBe(404);
    });
  });
});

describe("Health API", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
