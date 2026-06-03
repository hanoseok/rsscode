import { describe, it, expect, beforeEach, vi } from "vitest";
import { testDb } from "./setup.js";
import { users, workspaces, workspaceMembers, feeds } from "../db/schema.js";

vi.mock("../db/index.js", () => ({ db: testDb }));

import {
  getUserWorkspaceIds,
  userCanAccessWorkspace,
  userCanAccessFeed,
} from "../lib/workspaces.js";

describe("Workspace access helpers", () => {
  let aliceId: number;
  let bobId: number;
  let aliceWsId: number;
  let bobWsId: number;
  let sharedWsId: number;
  let aliceFeedId: number;
  let bobFeedId: number;
  let sharedFeedId: number;

  beforeEach(() => {
    const alice = testDb
      .insert(users)
      .values({ username: "alice", passwordHash: "h" })
      .returning()
      .get();
    const bob = testDb
      .insert(users)
      .values({ username: "bob", passwordHash: "h" })
      .returning()
      .get();
    aliceId = alice.id;
    bobId = bob.id;

    aliceWsId = testDb
      .insert(workspaces)
      .values({ name: "alice-ws", ownerId: aliceId })
      .returning()
      .get().id;
    bobWsId = testDb
      .insert(workspaces)
      .values({ name: "bob-ws", ownerId: bobId })
      .returning()
      .get().id;
    sharedWsId = testDb
      .insert(workspaces)
      .values({ name: "shared", ownerId: aliceId })
      .returning()
      .get().id;

    testDb
      .insert(workspaceMembers)
      .values({ workspaceId: sharedWsId, userId: bobId, role: "member" })
      .run();

    aliceFeedId = testDb
      .insert(feeds)
      .values({ workspaceId: aliceWsId, name: "a", url: "https://a.example.com" })
      .returning()
      .get().id;
    bobFeedId = testDb
      .insert(feeds)
      .values({ workspaceId: bobWsId, name: "b", url: "https://b.example.com" })
      .returning()
      .get().id;
    sharedFeedId = testDb
      .insert(feeds)
      .values({ workspaceId: sharedWsId, name: "s", url: "https://s.example.com" })
      .returning()
      .get().id;
  });

  describe("getUserWorkspaceIds", () => {
    it("returns owned and member workspaces, deduplicated", () => {
      const ids = getUserWorkspaceIds(aliceId).sort();
      expect(ids).toEqual([aliceWsId, sharedWsId].sort());
    });

    it("returns only member workspace for the non-owner", () => {
      const ids = getUserWorkspaceIds(bobId).sort();
      expect(ids).toEqual([bobWsId, sharedWsId].sort());
    });

    it("returns empty for an unknown user", () => {
      expect(getUserWorkspaceIds(99999)).toEqual([]);
    });
  });

  describe("userCanAccessWorkspace", () => {
    it("allows owner", () => {
      expect(userCanAccessWorkspace(aliceId, aliceWsId)).toBe(true);
    });

    it("allows member", () => {
      expect(userCanAccessWorkspace(bobId, sharedWsId)).toBe(true);
    });

    it("denies non-member", () => {
      expect(userCanAccessWorkspace(bobId, aliceWsId)).toBe(false);
      expect(userCanAccessWorkspace(aliceId, bobWsId)).toBe(false);
    });
  });

  describe("userCanAccessFeed", () => {
    it("allows owner of the feed's workspace", () => {
      expect(userCanAccessFeed(aliceId, aliceFeedId)).toBe(true);
    });

    it("allows member of the feed's workspace", () => {
      expect(userCanAccessFeed(bobId, sharedFeedId)).toBe(true);
    });

    it("denies users outside the feed's workspace", () => {
      expect(userCanAccessFeed(bobId, aliceFeedId)).toBe(false);
      expect(userCanAccessFeed(aliceId, bobFeedId)).toBe(false);
    });

    it("denies for an unknown feedId", () => {
      expect(userCanAccessFeed(aliceId, 99999)).toBe(false);
    });
  });
});
