import { describe, expect, it } from "vitest";

import { locatePlantUml, parsePlantUml } from "../locate/puml";
import { pumlEditor } from "./puml";

const DOC = `@startuml
' a comment mentioning web, which must not change
skinparam componentStyle rectangle

actor Customer
component "Storefront" as web
component checkout
database "Orders" as db

Customer --> web : browses
web --> checkout : POST /checkout
checkout --> db : write order
@enduml
`;

describe("renaming a PlantUML node", () => {
  it("changes the alias and every link that uses it", () => {
    const edit = pumlEditor.rename(DOC, "web", "storefront")!;

    expect(edit.source).toContain('component "Storefront" as storefront');
    expect(edit.source).toContain("Customer --> storefront : browses");
    expect(edit.source).toContain("storefront --> checkout : POST /checkout");
  });


  it("leaves the label and the comments alone", () => {
    const edit = pumlEditor.rename(DOC, "web", "storefront")!;

    expect(edit.source).toContain('"Storefront"');
    expect(edit.source).toContain("' a comment mentioning web");
  });

  it("renames a node that was only ever declared by a link", () => {
    const edit = pumlEditor.rename("@startuml\na --> b\nb --> c\n@enduml\n", "b", "middle")!;
    expect(edit.source).toBe("@startuml\na --> middle\nmiddle --> c\n@enduml\n");
  });

  it("renames a bare declaration", () => {
    const edit = pumlEditor.rename(DOC, "checkout", "pay")!;

    expect(edit.source).toContain("component pay");
    expect(edit.source).toContain("web --> pay : POST /checkout");
    expect(edit.source).toContain("pay --> db : write order");
  });

  it("renames the node inside a bracket form without touching the brackets", () => {
    const edit = pumlEditor.rename("@startuml\n[web]\n[web] --> [api]\n@enduml\n", "web", "store")!;

    expect(edit.source).toContain("[store]");
    expect(edit.source).toContain("[store] --> [api]");
  });

  it("follows a node inside a package", () => {
    const source = `@startuml
package edge {
  component web
}
web --> db
@enduml
`;

    const edit = pumlEditor.rename(source, "edge.web", "edge.store")!;
    expect(edit.source).toContain("component store");
  });

  it("refuses a name PlantUML could not read", () => {
    expect(pumlEditor.rename(DOC, "web", "two words")).toBeNull();
    expect(pumlEditor.rename(DOC, "web", '"quoted"')).toBeNull();
    expect(pumlEditor.rename(DOC, "web", "component")).toBeNull();
    expect(pumlEditor.rename(DOC, "web", "")).toBeNull();
  });

  it("refuses to move a node into another package", () => {
    expect(pumlEditor.rename(DOC, "web", "core.web")).toBeNull();
  });

  it("refuses an id the file does not have", () => {
    expect(pumlEditor.rename(DOC, "nope", "x")).toBeNull();
  });

  it("does not rename a class member that happens to share the name", () => {
    const source = `@startuml
class Order {
  web: String
}
Order --> web
@enduml
`;
    const edit = pumlEditor.rename(source, "web", "site")!;

    expect(edit.source).toContain("  web: String");
    expect(edit.source).toContain("Order --> site");
  });
});

describe("relabelling", () => {
  it("changes the quoted label", () => {
    const edit = pumlEditor.setLabel(DOC, "web", "Web storefront")!;

    expect(edit.source).toContain('component "Web storefront" as web');
    expect(edit.source).toContain("Customer --> web");
  });

  it("introduces an alias when the declaration had no label", () => {
    const edit = pumlEditor.setLabel(DOC, "checkout", "Checkout service")!;
    expect(edit.source).toContain('component "Checkout service" as checkout');
  });


  it("adds an alias to a bracket form rather than renaming it", () => {
    const edit = pumlEditor.setLabel("@startuml\n[web]\n[web] --> [api]\n@enduml\n", "web", "Store")!;
    expect(edit.source).toContain("[Store] as web");
  });

  it("does not let a quote in the label end the string", () => {
    const edit = pumlEditor.setLabel(DOC, "web", 'the "front" door')!;

    expect(edit.source).toContain("component \"the 'front' door\" as web");
    expect(parsePlantUml(edit.source).entities.has("web")).toBe(true);
  });
});

describe("reshaping", () => {
  it("changes the keyword", () => {
    const edit = pumlEditor.setShape(DOC, "checkout", "cylinder")!;
    expect(edit.source).toContain("database checkout");
  });

  it("keeps the label and the alias", () => {
    const edit = pumlEditor.setShape(DOC, "web", "queue")!;
    expect(edit.source).toContain('queue "Storefront" as web');
  });


  it("refuses a bracket form, which is already a shape", () => {
    expect(pumlEditor.setShape("@startuml\n[web]\n@enduml\n", "web", "cylinder")).toBeNull();
  });

  it("refuses a shape PlantUML has no keyword for", () => {
    expect(pumlEditor.setShape(DOC, "checkout", "trapezoid")).toBeNull();
  });
});

describe("PlantUML's layout direction", () => {
  const tuner = pumlEditor.tuning!;

  it("reads the directive when the file has one", () => {
    expect(tuner.read("@startuml\nleft to right direction\na --> b\n@enduml\n")).toEqual({
      direction: "left to right direction",
    });
    expect(tuner.read(DOC)).toEqual({});
  });

  it("adds it directly after @startuml, where PlantUML reads it", () => {
    const edit = tuner.set(DOC, "direction", "left to right direction")!;
    expect(edit.source.startsWith("@startuml\nleft to right direction\n")).toBe(true);
  });

  it("changes one that is already there", () => {
    const source = "@startuml\nleft to right direction\na --> b\n@enduml\n";
    const edit = tuner.set(source, "direction", "top to bottom direction")!;


    expect(edit.source).toBe("@startuml\na --> b\n@enduml\n");
  });

  it("leaves a file that already says nothing exactly as it was", () => {
    expect(tuner.set(DOC, "direction", "top to bottom direction")!.source).toBe(DOC);
  });
});


describe("what the parser makes of the result", () => {
  it("keeps every node and link through a rename", () => {
    const before = parsePlantUml(DOC);
    const after = parsePlantUml(pumlEditor.rename(DOC, "web", "storefront")!.source);

    expect(after.entities.size).toBe(before.entities.size);
    expect(after.links).toHaveLength(before.links.length);
    expect(after.entities.has("storefront")).toBe(true);
    expect(after.entities.has("web")).toBe(false);
  });

  it("leaves locate able to find the renamed node", () => {
    const index = locatePlantUml(pumlEditor.rename(DOC, "web", "storefront")!.source);

    expect(index.nodes.has("storefront")).toBe(true);
    expect(index.nodes.has("web")).toBe(false);
  });

  it("keeps the label the parser reads back", () => {
    const edit = pumlEditor.setLabel(DOC, "checkout", "Checkout service")!;
    expect(parsePlantUml(edit.source).entities.get("checkout")!.label).toBe("Checkout service");
  });

  it("keeps the shape the parser reads back", () => {
    const edit = pumlEditor.setShape(DOC, "checkout", "cylinder")!;
    expect(parsePlantUml(edit.source).entities.get("checkout")!.shape).toBe("cylinder");
  });

  it("writes a keyword for every shape it offers", () => {
    for (const shape of pumlEditor.shapes) {
      const edit = pumlEditor.setShape(DOC, "checkout", shape);
      if (!edit) continue;

      const entity = parsePlantUml(edit.source).entities.get("checkout");
      expect(entity, shape).toBeTruthy();
      expect(entity!.shape, shape).toBe(shape);
    }
  });
});
