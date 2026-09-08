import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseSidecar, SidecarError } from "./read";


const WRITTEN = readFileSync("tests/fixtures/sidecar/full.zlayout.toml", "utf8");

describe("reading a sidecar", () => {
  const sidecar = parseSidecar(WRITTEN);

  it("reads the pins, coordinates and all", () => {
    expect(sidecar.pins!.api).toEqual({
      x: 412,
      y: 288,
      fingerprint: "box:API:0",
      auto: [120, 40],
    });
  });

  it("leaves the optional halves of a pin absent rather than invented", () => {
    expect(sidecar.pins!.cache).toEqual({
      x: 760,
      y: 210,
      fingerprint: null,
      auto: null,
    });
  });

  it("reads an edge's route and its label nudge", () => {
    expect(sidecar.edges!["gateway->api"]).toEqual({
      waypoints: [
        [500, 240],
        [520, 260],
      ],
      label_offset: [4, -8],
    });
  });

  it("reads an annotation", () => {
    expect(sidecar.annotations!.a1!.text).toBe("why two writers?");
    expect(sidecar.annotations!.a1!.anchor).toBe("api");
  });

  it("reads the sequence hints", () => {
    expect(sidecar.sequence!.lifeline_order).toEqual(["browser", "api"]);
    expect(sidecar.sequence!.lifeline_gap!.api).toBe(40);
  });

  it("reads the theme this file chose", () => {
    expect(sidecar.theme!.name).toBe("Blueprint");
  });

  it("reads a markdown document's per-block tables", () => {
    const blocks = parseSidecar(`version = 1

[blocks.auth-flow.pins.login]
x = 10
y = 20

[blocks.topology.pins.lb]
x = 30
y = 40
`);

    expect(Object.keys(blocks.blocks!)).toEqual(["auth-flow", "topology"]);
    expect(blocks.blocks!["auth-flow"]!.pins!.login!.x).toBe(10);
  });

  it("reads an empty file as an empty layout", () => {
    const empty = parseSidecar("version = 1\n");
    expect(empty.pins).toEqual({});
    expect(empty.theme).toBeNull();
  });
});


describe("a sidecar somebody broke", () => {
  it("drops a pin with a coordinate that is not a number", () => {
    const sidecar = parseSidecar(`version = 1

[pins.good]
x = 1
y = 2

[pins.bad]
x = "left"
y = 2
`);

    expect(Object.keys(sidecar.pins!)).toEqual(["good"]);
  });

  it("drops half a pin rather than placing the node at zero", () => {
    const sidecar = parseSidecar("version = 1\n\n[pins.half]\nx = 10\n");
    expect(sidecar.pins).toEqual({});
  });

  it("keeps the waypoints that parse and drops the ones that do not", () => {
    const sidecar = parseSidecar(`version = 1

[edges.e]
waypoints = [[1, 2], "nope", [3, 4]]
`);

    expect(sidecar.edges!.e!.waypoints).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("drops an annotation with no kind, which cannot be drawn", () => {
    const sidecar = parseSidecar('version = 1\n\n[annotations.a1]\nat = [1, 2]\ntext = "hi"\n');
    expect(sidecar.annotations).toEqual({});
  });

  it("names a merge conflict instead of reporting a syntax error", () => {
    const conflicted = `version = 1
<<<<<<< HEAD
[pins.api]
x = 1
=======
[pins.api]
x = 2
>>>>>>> theirs
`;

    const error = (() => {
      try {
        parseSidecar(conflicted);
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(SidecarError);
    expect((error as Error).message).toContain("merge conflict");
  });

  it("explains a file that is not TOML at all, with a remedy", () => {
    const error = (() => {
      try {
        parseSidecar("this is not toml {{{");
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(SidecarError);
    expect((error as SidecarError).remedy).toContain("auto-layout");
  });

  it("assumes version 1 when the file forgot to say", () => {
    expect(parseSidecar("[pins.a]\nx = 1\ny = 2\n").version).toBe(1);
  });
});
