import { describe, expect, it } from "vitest";

import { withExtensionOf } from "./saveAs";

describe("withExtensionOf", () => {
  it("adds the original ending when the new name has none", () => {
    expect(withExtensionOf("/d/flow-copy", "/d/flow.mmd")).toBe("/d/flow-copy.mmd");
  });

  it("keeps a name that already ends the same way, in any case", () => {
    expect(withExtensionOf("C:\\d\\Flow.MMD", "C:\\d\\flow.mmd")).toBe("C:\\d\\Flow.MMD");
  });

  it("refuses a different ending, since the engine comes from it", () => {
    expect(withExtensionOf("/d/flow.dot", "/d/flow.mmd")).toBeNull();
  });

  it("does not mistake a dot in a folder name for an ending", () => {
    expect(withExtensionOf("/d/v1.2/flow", "/d/flow.mmd")).toBe("/d/v1.2/flow.mmd");
  });
});
