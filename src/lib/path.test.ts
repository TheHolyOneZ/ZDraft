import { describe, expect, it } from "vitest";

import { baseName, dirName, joinPath, samePath, splitExtension } from "./path";

describe("path helpers", () => {
  it("splits a folder from its file on either platform", () => {
    expect(dirName("/home/me/diagrams/a.mmd")).toBe("/home/me/diagrams");
    expect(dirName("C:\\Users\\me\\a.mmd")).toBe("C:\\Users\\me");
    expect(dirName("C:\\a.mmd")).toBe("C:\\");
    expect(dirName("/a.mmd")).toBe("/");
    expect(dirName("a.mmd")).toBe("");
    expect(baseName("C:\\Users\\me\\a.mmd")).toBe("a.mmd");
  });

  it("splits a name from its extension, leaving dotfiles alone", () => {
    expect(splitExtension("flow.mmd")).toEqual({ stem: "flow", ext: "mmd" });
    expect(splitExtension("my.flow.dot")).toEqual({ stem: "my.flow", ext: "dot" });
    expect(splitExtension("README")).toEqual({ stem: "README", ext: "" });
    expect(splitExtension(".hidden")).toEqual({ stem: ".hidden", ext: "" });
  });

  it("treats a Windows path as the same file whatever its case or slashes", () => {
    expect(samePath("C:\\Diagrams\\a.mmd", "c:/diagrams/A.mmd")).toBe(true);
    expect(samePath("/home/me/a.mmd", "/home/me/A.mmd")).toBe(false);
    expect(samePath("/home/me/a.mmd", "/home/me//a.mmd")).toBe(true);
  });

  it("joins with the separator the folder already uses", () => {
    expect(joinPath("C:\\Users\\me", "a.mmd")).toBe("C:\\Users\\me\\a.mmd");
    expect(joinPath("/home/me/", "a.mmd")).toBe("/home/me/a.mmd");
  });
});
