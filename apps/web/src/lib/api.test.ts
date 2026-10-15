import { afterEach, describe, it, expect, vi } from "vitest";
import { api, ApiError } from "./api";
afterEach(() => vi.unstubAllGlobals());
describe("API boundary", () => {
  it("uses same-origin credentials and unwraps successful data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ total: 12 }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await api("/portfolio")).toEqual({ total: 12 });
    expect(fetch.mock.calls[0][1].credentials).toBe("same-origin");
  });
  it("preserves HTTP status for authentication decisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ detail: "Start a local demo session" }),
            { status: 401 },
          ),
        ),
    );
    try {
      await api("/session");
      throw new Error("Expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
    }
  });
  it("turns field validation into readable messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: [
              { loc: ["body", "threshold"], msg: "Must be at least 0.1" },
            ],
          }),
          { status: 422 },
        ),
      ),
    );
    await expect(api("/settings")).rejects.toThrow(
      "threshold: Must be at least 0.1",
    );
  });
});
