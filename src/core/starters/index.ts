import type { EngineId } from "../model/scene";


export interface Starter {
  id: string;
  engine: EngineId;
  label: string;

  description: string;
  source: string;
}

export const STARTERS: readonly Starter[] = [
  {
    id: "graphviz-flow",
    engine: "graphviz",
    label: "Flow",
    description: "A directed graph. Graphviz lays it out left to right.",
    source: `digraph flow {
  rankdir=LR;
  node [shape=box, style=rounded];

  client [label="Client"];
  service [label="Service"];
  store [shape=cylinder, label="Store"];

  client -> service [label="request"];
  service -> store [label="read/write"];
}
`,
  },
  {
    id: "graphviz-grouped",
    engine: "graphviz",
    label: "Grouped flow",
    description: "The same, with subgraphs you can drag as a unit.",
    source: `digraph grouped {
  rankdir=LR;
  node [shape=box, style=rounded];

  subgraph cluster_edge {
    label="edge";
    cdn [label="CDN"];
    gateway [label="Gateway"];
  }

  subgraph cluster_core {
    label="core";
    api [label="API"];
    worker [label="Worker"];
  }

  db [shape=cylinder, label="Database"];

  cdn -> gateway;
  gateway -> api;
  api -> worker;
  api -> db;
}
`,
  },
  {
    id: "d2-system",
    engine: "d2",
    label: "System",
    description: "D2 containers. Drag a whole box and its contents come along.",
    source: `direction: right

edge: Edge {
  cdn: CDN {shape: cloud}
  gateway: Gateway {shape: hexagon}
}

core: Core {
  api: API
  worker: Worker
}

db: Database {shape: cylinder}

edge.cdn -> edge.gateway: miss
edge.gateway -> core.api: HTTP
core.api -> core.worker: enqueue
core.api -> db: SQL
`,
  },
  {
    id: "d2-classes",
    engine: "d2",
    label: "Classes",
    description: "D2 class shapes, with fields and methods in compartments.",
    source: `Document: {
  shape: class
  path: string
  engine: string
  +open(): Document
  +save()
}

Layout: {
  shape: class
  pins: map
  +apply(scene): Scene
}

Document -> Layout: reads
`,
  },
  {
    id: "mermaid-flowchart",
    engine: "mermaid",
    label: "Flowchart",
    description: "Mermaid's flowchart. Renders on GitHub as-is.",
    source: `flowchart TD
  start([Start]) --> check{Ready?}
  check -->|yes| work[Do the work]
  check -->|no| wait[Wait]
  wait --> check
  work --> done([Done])
`,
  },
  {
    id: "mermaid-sequence",
    engine: "mermaid",
    label: "Sequence",
    description: "Lifelines you can reorder by dragging their headers.",
    source: `sequenceDiagram
  participant Client
  participant API
  participant DB

  Client->>API: GET /thing
  API->>DB: select
  DB-->>API: row
  API-->>Client: 200 OK
`,
  },
  {
    id: "mermaid-class",
    engine: "mermaid",
    label: "Class",
    description: "Compartmented boxes — attributes and methods.",
    source: `classDiagram
  class Document {
    +String name
    +load()
    +save()
  }
  class Layout {
    +Map pins
    +apply()
  }
  Document --> Layout
`,
  },
  {
    id: "mermaid-state",
    engine: "mermaid",
    label: "State machine",
    description: "States and transitions, with a start and an end.",
    source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: open
  Loading --> Ready: parsed
  Loading --> Failed: error
  Failed --> Loading: retry
  Ready --> [*]
`,
  },
  {
    id: "mermaid-er",
    engine: "mermaid",
    label: "Entities",
    description: "An ER diagram. Entities pin like any other node.",
    source: `erDiagram
  USER ||--o{ DOCUMENT : owns
  DOCUMENT ||--o{ PIN : has
  USER {
    string id
    string name
  }
  DOCUMENT {
    string path
    string engine
  }
`,
  },
];


export const DEFAULT_STARTER = STARTERS[0]!;

export function starterById(id: string): Starter | undefined {
  return STARTERS.find((s) => s.id === id);
}


export const EXTENSION_FOR: Record<EngineId, string> = {
  graphviz: ".dot",
  mermaid: ".mmd",
  d2: ".d2",
  plantuml: ".puml",
};


export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "A name is needed.";
  if (/[\\/]/.test(trimmed)) return "A name cannot contain a slash.";
  if (/[<>:"|?*]/.test(trimmed)) return 'A name cannot contain < > : " | ? *';
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return "A name cannot contain control characters.";
  if (trimmed === "." || trimmed === "..") return "That name is reserved.";
  if (trimmed.startsWith(".")) return "A leading dot would hide the file.";
  if (trimmed.endsWith(".") || name.endsWith(" ")) {
    return "A name cannot end with a dot or a space.";
  }
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(trimmed.replace(/\.[^.]*$/, ""))) {
    return "That name is reserved on Windows.";
  }
  if (trimmed.length > 120) return "That name is too long.";
  return null;
}


export function withExtension(name: string, extension: string): string {
  const trimmed = name.trim();
  return trimmed.toLowerCase().endsWith(extension) ? trimmed : trimmed + extension;
}
