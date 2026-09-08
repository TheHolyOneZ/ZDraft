import {
  isGraph,
  isSequence,
  nodeText,
  type GraphScene,
  type Scene,
  type SequenceScene,
} from "../model/scene";


export interface RevealStep {

  title: string;

  reveal: string[];
}


export function revealSteps(scene: Scene | null): RevealStep[] {
  if (!scene) return [];
  if (isGraph(scene)) return graphSteps(scene);
  if (isSequence(scene)) return sequenceSteps(scene);
  return [];
}


function graphSteps(scene: GraphScene): RevealStep[] {
  if (scene.nodes.length < 2) return [];

  const order = new Map(scene.nodes.map((n, i) => [n.id, i]));
  const indegree = new Map(scene.nodes.map((n) => [n.id, 0]));
  const out = new Map<string, string[]>(scene.nodes.map((n) => [n.id, []]));

  for (const edge of scene.edges) {

    if (edge.from === edge.to) continue;
    if (!order.has(edge.from) || !order.has(edge.to)) continue;

    out.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
  }

  const left = new Set(order.keys());
  const steps: RevealStep[] = [];

  let ready = scene.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);

  while (left.size > 0) {
    if (ready.length === 0) {


      const earliest = [...left].sort((a, b) => order.get(a)! - order.get(b)!)[0]!;
      ready = [earliest];
    }

    const level = ready.filter((id) => left.has(id));
    if (level.length === 0) break;

    for (const id of level) left.delete(id);
    steps.push({ title: titleFor(scene, level), reveal: level });

    const next: string[] = [];
    for (const id of level) {
      for (const to of out.get(id) ?? []) {
        if (!left.has(to)) continue;
        indegree.set(to, indegree.get(to)! - 1);
        if (indegree.get(to) === 0) next.push(to);
      }
    }
    ready = next.sort((a, b) => order.get(a)! - order.get(b)!);
  }

  return steps.length > 1 ? steps : [];
}


function titleFor(scene: GraphScene, ids: readonly string[]): string {
  const nodes = ids
    .map((id) => scene.nodes.find((n) => n.id === id))
    .filter((n): n is GraphScene["nodes"][number] => Boolean(n));

  if (nodes.length === 0) return "…";

  const parent = nodes[0]!.parent;
  if (parent && nodes.length > 1 && nodes.every((n) => n.parent === parent)) {
    const cluster = scene.clusters.find((c) => c.id === parent);
    if (cluster?.label) return cluster.label;
  }

  const labels = nodes.map((n) => oneLine(nodeText(n.body) || n.id));
  if (labels.length <= 3) return labels.join(" · ");
  return `${labels.slice(0, 3).join(" · ")} +${labels.length - 3}`;
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim();
}


function sequenceSteps(scene: SequenceScene): RevealStep[] {
  if (scene.messages.length === 0) return [];

  const name = (id: string) => scene.lifelines.find((l) => l.id === id)?.label ?? id;
  const ordered = [...scene.messages].sort((a, b) => a.order - b.order);

  return [
    { title: "The participants", reveal: [] },
    ...ordered.map((message) => ({
      title: oneLine(message.label) || `${name(message.from)} → ${name(message.to)}`,
      reveal: [message.id],
    })),
  ];
}


export function sceneAtStep(scene: Scene, steps: readonly RevealStep[], index: number): Scene {
  if (steps.length === 0) return scene;

  const shown = new Set<string>();
  for (let i = 0; i <= Math.min(index, steps.length - 1); i += 1) {
    for (const id of steps[i]!.reveal) shown.add(id);
  }

  if (isGraph(scene)) return graphAtStep(scene, shown);
  if (isSequence(scene)) return sequenceAtStep(scene, shown);
  return scene;
}

function graphAtStep(scene: GraphScene, shown: ReadonlySet<string>): GraphScene {
  const nodes = scene.nodes.filter((n) => shown.has(n.id));


  const clusters = scene.clusters.filter((cluster) =>
    nodes.some((n) => inCluster(scene, n.parent, cluster.id)),
  );

  return {
    ...scene,
    nodes,

    edges: scene.edges.filter((e) => shown.has(e.from) && shown.has(e.to)),
    clusters,
  };
}


function inCluster(scene: GraphScene, parent: string | undefined, clusterId: string): boolean {
  let at = parent;
  const guard = new Set<string>();

  while (at && !guard.has(at)) {
    if (at === clusterId) return true;
    guard.add(at);
    at = scene.clusters.find((c) => c.id === at)?.parent;
  }
  return false;
}


function sequenceAtStep(scene: SequenceScene, shown: ReadonlySet<string>): SequenceScene {
  const messages = scene.messages.filter((m) => shown.has(m.id));
  const floor = messages.reduce((y, m) => Math.max(y, m.y), headBottom(scene));

  return {
    ...scene,
    messages,
    activations: scene.activations
      .filter((a) => a.top <= floor)
      .map((a) => ({ ...a, bottom: Math.min(a.bottom, floor) })),
    fragments: scene.fragments.filter((f) => f.rect.y <= floor),
    notes: scene.notes.filter((n) => n.rect.y <= floor),
  };
}


function headBottom(scene: SequenceScene): number {
  return scene.lifelines.reduce((y, l) => Math.max(y, l.head.y + l.head.h), 0);
}
