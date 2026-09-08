import { describe, expect, it } from "vitest";

import { graphvizAdapter } from "../engines/graphviz";
import { layoutSequence } from "../sequence/layout";
import { parseSequence } from "../locate/sequence";
import { themeByName } from "../theme";
import { isGraph, isSequence, type GraphScene, type SequenceScene } from "../model/scene";
import { revealSteps, sceneAtStep } from ".";

async function graph(source: string): Promise<GraphScene> {
  const result = await graphvizAdapter.layout(source);
  if (!isGraph(result.scene)) throw new Error("expected a graph scene");
  return result.scene;
}


function visible(scene: GraphScene, steps: ReturnType<typeof revealSteps>, index: number) {
  const at = sceneAtStep(scene, steps, index);
  if (!isGraph(at)) throw new Error("expected a graph scene");
  return at;
}

const CHAIN = "digraph d { a -> b; b -> c; c -> d; }";

describe("revealSteps, on a graph", () => {
  it("walks the flow: sources first, then what they reach", async () => {
    const scene = await graph(CHAIN);
    expect(revealSteps(scene).map((s) => s.reveal)).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("reveals siblings together, because they are one thought", async () => {
    const scene = await graph("digraph d { gw -> orders; gw -> payments; gw -> search; }");
    const steps = revealSteps(scene);

    expect(steps[0]!.reveal).toEqual(["gw"]);
    expect(steps[1]!.reveal.sort()).toEqual(["orders", "payments", "search"]);
  });

  it("names a step after its cluster when the whole cluster arrives at once", async () => {
    const scene = await graph(`digraph d {
      gw;
      subgraph cluster_s { label="services"; orders; payments; }
      gw -> orders; gw -> payments;
    }`);

    expect(revealSteps(scene)[1]!.title).toBe("services");
  });

  it("names a lone step after the node itself", async () => {
    const scene = await graph('digraph d { a [label="Ingress"]; a -> b; }');
    expect(revealSteps(scene)[0]!.title).toBe("Ingress");
  });


  it("finds a way into a cycle rather than omitting it", async () => {
    const scene = await graph("digraph d { a -> b; b -> c; c -> a; }");
    const steps = revealSteps(scene);

    expect(steps.flatMap((s) => s.reveal).sort()).toEqual(["a", "b", "c"]);
  });

  it("has nothing to stage for a single node", async () => {
    expect(revealSteps(await graph("digraph d { only; }"))).toEqual([]);
  });

  it("reveals every node by the last step", async () => {
    const scene = await graph(CHAIN);
    const steps = revealSteps(scene);

    expect(visible(scene, steps, steps.length - 1).nodes).toHaveLength(scene.nodes.length);
  });
});

describe("sceneAtStep, on a graph", () => {
  it("keeps the finished diagram's bounds at every step", async () => {
    const scene = await graph(CHAIN);
    const steps = revealSteps(scene);


    for (let i = 0; i < steps.length; i += 1) {
      expect(visible(scene, steps, i).bounds).toEqual(scene.bounds);
    }
  });

  it("never moves a node once it has appeared", async () => {
    const scene = await graph(CHAIN);
    const steps = revealSteps(scene);
    const first = visible(scene, steps, 0).nodes[0]!;

    const last = visible(scene, steps, steps.length - 1).nodes.find((n) => n.id === first.id);
    expect(last!.rect).toEqual(first.rect);
  });

  it("draws an edge only once both of its ends are on stage", async () => {
    const scene = await graph(CHAIN);
    const steps = revealSteps(scene);

    expect(visible(scene, steps, 0).edges).toHaveLength(0);
    expect(visible(scene, steps, 1).edges.map((e) => e.id)).toEqual(["a->b"]);
  });

  it("holds a cluster back until something is inside it", async () => {
    const scene = await graph(`digraph d {
      gw;
      subgraph cluster_s { label="services"; orders; }
      gw -> orders;
    }`);
    const steps = revealSteps(scene);

    expect(visible(scene, steps, 0).clusters).toHaveLength(0);
    expect(visible(scene, steps, 1).clusters).toHaveLength(1);
  });
});

describe("revealSteps, on a sequence", () => {
  function sequence(source: string): SequenceScene {
    const scene = layoutSequence(parseSequence(source), { theme: themeByName("blueprint") });
    if (!isSequence(scene)) throw new Error("expected a sequence scene");
    return scene;
  }

  const CONVERSATION = `sequenceDiagram
    participant A as Browser
    participant B as API
    A->>B: GET /orders
    B-->>A: 200 OK`;

  it("opens on the cast, then one message at a time", () => {
    const steps = revealSteps(sequence(CONVERSATION));

    expect(steps[0]!.title).toBe("The participants");
    expect(steps[0]!.reveal).toEqual([]);
    expect(steps).toHaveLength(3);
  });

  it("names each step after the message", () => {
    expect(revealSteps(sequence(CONVERSATION))[1]!.title).toBe("GET /orders");
  });

  it("keeps every lifeline on stage from the first step", () => {
    const scene = sequence(CONVERSATION);
    const at = sceneAtStep(scene, revealSteps(scene), 0);
    if (!isSequence(at)) throw new Error("expected a sequence scene");

    expect(at.lifelines).toHaveLength(scene.lifelines.length);
    expect(at.messages).toHaveLength(0);
  });

  it("grows an activation bar down to the last message shown", () => {
    const scene = sequence(CONVERSATION);
    const steps = revealSteps(scene);

    const mid = sceneAtStep(scene, steps, 1);
    const end = sceneAtStep(scene, steps, steps.length - 1);
    if (!isSequence(mid) || !isSequence(end)) throw new Error("expected sequence scenes");

    for (const bar of mid.activations) {
      const full = end.activations.find((a) => a.lifeline === bar.lifeline && a.top === bar.top);
      expect(bar.bottom).toBeLessThanOrEqual(full!.bottom);
    }
  });
});
