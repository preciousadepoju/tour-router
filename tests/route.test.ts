import { describe, expect, it } from "vitest";
import { haversineKm, orderRoute, pathLengthKm } from "@/lib/route";

const P = (lat: number, lng: number, id = `${lat},${lng}`) => ({ id, lat, lng });

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(P(6.5, 3.4), P(6.5, 3.4))).toBe(0);
  });

  it("matches the known London-Paris distance (~344 km)", () => {
    expect(haversineKm(P(51.5074, -0.1278), P(48.8566, 2.3522))).toBeCloseTo(344, -1);
  });
});

describe("orderRoute", () => {
  it("handles 0, 1 and 2 points", () => {
    expect(orderRoute([])).toEqual([]);
    expect(orderRoute([P(1, 1)])).toHaveLength(1);
    expect(orderRoute([P(1, 1), P(2, 2)])).toHaveLength(2);
  });

  it("keeps every stop exactly once", () => {
    const pts = [P(0, 0, "a"), P(0, 5, "b"), P(0, 1, "c"), P(0, 9, "d"), P(0, 3, "e")];
    const ids = orderRoute(pts).map((p) => p.id).sort();
    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("finds the straight-line order for points on a line", () => {
    const pts = [P(0, 5, "b"), P(0, 0, "a"), P(0, 9, "d"), P(0, 1, "c"), P(0, 3, "e")];
    const ids = orderRoute(pts).map((p) => p.id).join("");
    expect(["acebd", "dbeca"]).toContain(ids);
  });

  it("is never longer than the input order", () => {
    const pts = [P(51.5, -0.1), P(6.5, 3.4), P(48.9, 2.4), P(5.6, -0.2), P(53.5, -2.2), P(-26.2, 28.0)];
    expect(pathLengthKm(orderRoute(pts))).toBeLessThanOrEqual(pathLengthKm(pts));
  });

  it("groups continents instead of zig-zagging", () => {
    // London, Lagos, Paris, Accra: the best route visits Europe together and Africa together.
    const pts = [P(51.5, -0.1, "lon"), P(6.5, 3.4, "los"), P(48.9, 2.4, "par"), P(5.6, -0.2, "acc")];
    const ids = orderRoute(pts).map((p) => p.id);
    const europe = ids.map((id) => id === "lon" || id === "par");
    expect(europe).toSatisfy((e: boolean[]) => e.join() === "true,true,false,false" || e.join() === "false,false,true,true");
  });
});
