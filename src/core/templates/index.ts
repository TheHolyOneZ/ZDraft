import type { EngineId } from "../model/scene";


export type TemplateCategory =
  | "architecture"
  | "behaviour"
  | "data"
  | "infrastructure"
  | "people";

export interface Template {
  id: string;
  name: string;

  description: string;
  category: TemplateCategory;
  engine: EngineId;
  source: string;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  architecture: "Architecture",
  behaviour: "Behaviour",
  data: "Data",
  infrastructure: "Infrastructure",
  people: "People",
};

export const TEMPLATES: readonly Template[] = [

  {
    id: "c4-context",
    name: "C4 — system context",
    description: "Who uses the system and what it depends on. The diagram you show first.",
    category: "architecture",
    engine: "d2",
    source: `# C4 level 1: the system and everything around it.
# Keep this one boring — its job is to be understood in ten seconds.
#
# No colours here on purpose: ZDraft's diagram theme dresses it, so this
# looks like a sibling of every other diagram in the folder.

direction: right

customer: Customer {shape: person}
support: Support agent {shape: person}

# One box. If you are tempted to draw two, this is a container diagram.
system: Payments platform

bank: Acquiring bank {shape: cylinder}
ledger: Finance system {shape: cylinder}
email: Email provider

customer -> system: Pays for an order
support -> system: Refunds, chases failures
system -> bank: Authorise and capture
system -> ledger: Nightly settlement file
system -> email: Receipts and failure notices
`,
  },
  {
    id: "c4-container",
    name: "C4 — containers",
    description: "One level in: the deployable pieces of a single system and how they talk.",
    category: "architecture",
    engine: "d2",
    source: `# C4 level 2. Every box here is something you can deploy and restart
# on its own — that is the test for whether it belongs.

direction: right

customer: Customer {shape: person}

platform: Payments platform {
  web: Web app (React)
  api: Payments API (Go)
  worker: Settlement worker (Go)
  queue: Event bus {shape: queue}
  db: Payments DB (Postgres) {shape: cylinder}
}

bank: Acquiring bank

customer -> platform.web: HTTPS
platform.web -> platform.api: JSON over HTTPS
platform.api -> platform.db: reads and writes
platform.api -> platform.queue: publishes payment.authorised
platform.queue -> platform.worker: consumes
platform.worker -> platform.db: writes settlement
platform.worker -> bank: submits batch
`,
  },
  {
    id: "service-topology",
    name: "Service topology",
    description: "What sits behind the load balancer, and which datastore each service owns.",
    category: "architecture",
    engine: "graphviz",
    source: `/* One service per box, one datastore per service.
   A datastore with two arrows into it is the thing to argue about. */

digraph topology {
  rankdir=LR;
  node [shape=box, style=rounded];
  compound=true;

  internet [shape=cloud, label="Internet"];
  lb [label="Load balancer"];

  subgraph cluster_edge {
    label="edge";
    style=dashed;
    cdn [label="CDN"];
    gateway [shape=hexagon, label="API gateway"];
  }

  subgraph cluster_services {
    label="services";
    style=dashed;
    orders [label="Orders"];
    payments [label="Payments"];
    search [label="Search"];
  }

  orders_db [shape=cylinder, label="orders\\n(Postgres)"];
  payments_db [shape=cylinder, label="payments\\n(Postgres)"];
  index [shape=cylinder, label="search index\\n(OpenSearch)"];
  cache [shape=cylinder, label="sessions\\n(Redis)"];

  internet -> cdn;
  cdn -> lb [label="miss"];
  lb -> gateway;
  gateway -> orders;
  gateway -> payments;
  gateway -> search;
  gateway -> cache [label="session"];

  orders -> orders_db;
  payments -> payments_db;
  search -> index;
  orders -> payments [label="reserve", style=dashed];
}
`,
  },


  {
    id: "sequence-auth",
    name: "Sequence — sign-in with MFA",
    description: "A real request flow, including the branch everyone forgets to draw.",
    category: "behaviour",
    engine: "mermaid",
    source: `sequenceDiagram
  autonumber
  actor User
  participant Web as Web app
  participant API as Auth API
  participant DB as User store
  participant SMS as SMS provider

  User->>Web: Submits email and password
  Web->>API: POST /sessions
  API->>DB: Look up user
  DB-->>API: User record

  alt Password wrong
    API-->>Web: 401 Unauthorised
    Web-->>User: "Check your details"
  else Password correct, MFA enabled
    API->>SMS: Send one-time code
    API-->>Web: 202 Awaiting second factor
    User->>Web: Enters the code
    Web->>API: POST /sessions/verify
    API-->>Web: 201 Session created
    Web-->>User: Signed in
  else Password correct, no MFA
    API-->>Web: 201 Session created
    Web-->>User: Signed in
  end

  note over API,DB: Failed attempts are counted here,<br/>not in the web app.
`,
  },
  {
    id: "state-order",
    name: "State machine — order lifecycle",
    description: "Every state an order can be in, including the ones that need a human.",
    category: "behaviour",
    engine: "mermaid",
    source: `stateDiagram-v2
  [*] --> Draft

  Draft --> Placed: customer confirms
  Placed --> Authorising: send to acquirer

  Authorising --> Paid: authorised
  Authorising --> Declined: declined
  Authorising --> Review: flagged by fraud rules

  Review --> Paid: agent approves
  Review --> Cancelled: agent rejects

  Declined --> Authorising: customer retries
  Declined --> Cancelled: gave up

  Paid --> Fulfilling
  Fulfilling --> Shipped
  Shipped --> Delivered
  Delivered --> [*]

  Paid --> Refunding: refund requested
  Refunding --> Refunded
  Refunded --> [*]
  Cancelled --> [*]

  note right of Review
    The only state that
    waits on a person.
  end note
`,
  },
  {
    id: "flow-incident",
    name: "Runbook — incident triage",
    description: "A decision tree someone can actually follow at three in the morning.",
    category: "behaviour",
    engine: "mermaid",
    source: `flowchart TD
  alert([Page fires]) --> ack{Acknowledged<br/>within 5 min?}
  ack -->|no| escalate[Escalate to secondary]
  escalate --> ack

  ack -->|yes| scope{Customers<br/>affected?}
  scope -->|no| watch[Downgrade to a ticket]
  watch --> done

  scope -->|yes| declare[Declare an incident<br/>open a channel]
  declare --> mitigate{Known<br/>mitigation?}

  mitigate -->|yes| apply[Apply it]
  mitigate -->|no| rollback{Recent<br/>deploy?}

  rollback -->|yes| revert[Roll back]
  rollback -->|no| investigate[Investigate<br/>with a second pair of eyes]

  apply --> verify
  revert --> verify
  investigate --> verify

  verify{Recovered?} -->|no| mitigate
  verify -->|yes| comms[Update the status page]
  comms --> done([Write the review within 48h])
`,
  },


  {
    id: "er-commerce",
    name: "Entities — orders and payments",
    description: "A schema with the join tables in it, which is where the questions are.",
    category: "data",
    engine: "mermaid",
    source: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER ||--o{ ADDRESS : has
  ORDER ||--|{ ORDER_LINE : contains
  ORDER ||--o| PAYMENT : "settled by"
  ORDER }o--|| ADDRESS : "ships to"
  PRODUCT ||--o{ ORDER_LINE : "appears in"
  PAYMENT ||--o{ REFUND : "may have"

  CUSTOMER {
    uuid id PK
    string email UK
    string name
    timestamp created_at
  }
  ADDRESS {
    uuid id PK
    uuid customer_id FK
    string line1
    string postcode
    string country
  }
  ORDER {
    uuid id PK
    uuid customer_id FK
    uuid ship_to FK
    string status
    int total_minor
    string currency
  }
  ORDER_LINE {
    uuid id PK
    uuid order_id FK
    uuid product_id FK
    int quantity
    int unit_minor
  }
  PRODUCT {
    uuid id PK
    string sku UK
    string name
  }
  PAYMENT {
    uuid id PK
    uuid order_id FK
    string provider_ref UK
    string status
  }
  REFUND {
    uuid id PK
    uuid payment_id FK
    int amount_minor
    string reason
  }
`,
  },
  {
    id: "class-domain",
    name: "Classes — a domain model",
    description: "Types, what they own, and which way the dependencies point.",
    category: "data",
    engine: "mermaid",
    source: `classDiagram
  direction LR

  class Order {
    +OrderId id
    +CustomerId customer
    +OrderStatus status
    +Money total()
    +place() Result
    +cancel(reason) Result
  }

  class OrderLine {
    +ProductId product
    +int quantity
    +Money unitPrice
    +Money subtotal()
  }

  class Payment {
    +PaymentId id
    +String providerRef
    +authorise() Result
    +capture() Result
    +refund(amount) Result
  }

  class PaymentGateway {
    <<interface>>
    +authorise(request) Authorisation
    +capture(ref) Receipt
  }

  class StripeGateway
  class Money {
    +int minorUnits
    +String currency
    +plus(other) Money
  }

  Order "1" *-- "1..*" OrderLine : owns
  Order "1" o-- "0..1" Payment : settled by
  Payment ..> PaymentGateway : uses
  StripeGateway ..|> PaymentGateway
  OrderLine ..> Money
  Payment ..> Money
`,
  },
  {
    id: "pipeline",
    name: "Data pipeline",
    description: "Where the data comes from, what reshapes it, and who reads the result.",
    category: "data",
    engine: "d2",
    source: `# Left to right is time. Anything that fans in is a join you own.

direction: right

sources: Sources {
  app: App events {shape: queue}
  db: Production DB {shape: cylinder}
  vendor: Vendor CSV {shape: page}
}

ingest: Ingest {
  stream: Stream consumer
  cdc: Change capture
  drop: SFTP drop {shape: stored_data}
}

lake: Object store {shape: cylinder}

transform: Transform {
  clean: Clean and conform
  model: Dimensional model
}

warehouse: Warehouse {shape: cylinder}

consumers: Consumers {
  bi: Dashboards
  ml: Feature store {shape: cylinder}
  finance: Finance export {shape: document}
}

sources.app -> ingest.stream
sources.db -> ingest.cdc
sources.vendor -> ingest.drop

ingest.stream -> lake
ingest.cdc -> lake
ingest.drop -> lake

lake -> transform.clean -> transform.model -> warehouse

warehouse -> consumers.bi
warehouse -> consumers.ml
warehouse -> consumers.finance
`,
  },


  {
    id: "deployment",
    name: "Deployment — two regions",
    description: "What actually runs where, and what fails over when a region does not.",
    category: "infrastructure",
    engine: "graphviz",
    source: `/* One box per thing that can fail independently.
   If two boxes always fail together, they are one box. */

digraph deployment {
  rankdir=TB;
  compound=true;
  node [shape=box, style=rounded];

  dns [shape=hexagon, label="DNS\\n(latency routing)"];

  subgraph cluster_eu {
    label="eu-west-1  (primary)";
    style=dashed;

    subgraph cluster_eu_a {
      label="az-a";
      eu_a_api [label="api ×3"];
      eu_a_worker [label="worker ×2"];
    }
    subgraph cluster_eu_b {
      label="az-b";
      eu_b_api [label="api ×3"];
      eu_b_worker [label="worker ×2"];
    }

    eu_db [shape=cylinder, label="Postgres\\nprimary"];
  }

  subgraph cluster_us {
    label="us-east-1  (standby)";
    style=dashed;

    us_api [label="api ×2"];
    us_db [shape=cylinder, label="Postgres\\nread replica"];
  }

  dns -> eu_a_api;
  dns -> eu_b_api;
  dns -> us_api [style=dashed, label="on failover"];

  eu_a_api -> eu_db;
  eu_b_api -> eu_db;
  eu_a_worker -> eu_db;
  eu_b_worker -> eu_db;

  eu_db -> us_db [label="streaming replication", style=dashed];
  us_api -> us_db;
}
`,
  },
  {
    id: "network",
    name: "Network — VPC and subnets",
    description: "Which subnet each thing sits in, and every route that crosses a boundary.",
    category: "infrastructure",
    engine: "graphviz",
    source: `/* Every arrow that crosses a cluster boundary is a firewall rule
   somebody has to own. That is what this diagram is for. */

digraph network {
  rankdir=TB;
  node [shape=box, style=rounded];

  internet [shape=cloud, label="Internet"];

  subgraph cluster_vpc {
    label="vpc  10.0.0.0/16";
    style=dashed;

    subgraph cluster_public {
      label="public  10.0.0.0/24";
      alb [label="ALB"];
      nat [label="NAT gateway"];
      bastion [label="Bastion"];
    }

    subgraph cluster_private {
      label="private  10.0.10.0/24";
      app [label="App instances"];
    }

    subgraph cluster_data {
      label="data  10.0.20.0/24";
      db [shape=cylinder, label="RDS"];
      cache [shape=cylinder, label="ElastiCache"];
    }
  }

  internet -> alb [label="443"];
  internet -> bastion [label="22, office IPs only"];
  alb -> app [label="8080"];
  bastion -> app [label="22"];
  app -> db [label="5432"];
  app -> cache [label="6379"];
  app -> nat [label="egress"];
  nat -> internet;
}
`,
  },


  {
    id: "org-chart",
    name: "Org chart",
    description: "Reporting lines, with the dotted ones that make the real shape visible.",
    category: "people",
    engine: "graphviz",
    source: `/* Solid lines report; dotted lines are where the work actually flows.
   A team with only dotted lines in is a team nobody is accountable for. */

digraph org {
  rankdir=TB;
  node [shape=box, style="rounded,filled", fillcolor="#ffffff11"];
  edge [arrowhead=none];

  cto [label="CTO\\nA. Okafor"];

  eng [label="VP Engineering\\nR. Bianchi"];
  data [label="Head of Data\\nS. Nakamura"];
  sec [label="Head of Security\\nL. Dubois"];

  platform [label="Platform\\n6 engineers"];
  payments [label="Payments\\n5 engineers"];
  web [label="Web\\n4 engineers"];
  analytics [label="Analytics\\n3 engineers"];

  cto -> eng;
  cto -> data;
  cto -> sec;

  eng -> platform;
  eng -> payments;
  eng -> web;
  data -> analytics;

  sec -> platform [style=dotted, constraint=false];
  sec -> payments [style=dotted, constraint=false];
  data -> payments [style=dotted, constraint=false, label="embedded analyst"];
}
`,
  },
  {
    id: "journey",
    name: "Service blueprint",
    description: "What the customer sees, what staff do, and the systems behind both.",
    category: "people",
    engine: "d2",
    source: `# Three lanes, read left to right. The bottom lane is the one that
# gets forgotten and then breaks the top one.

direction: right

customer: What the customer does {
  browse: Browses
  checkout: Checks out
  waits: Waits for delivery
  chases: Chases a late order
}

staff: What staff do {
  pick: Pick and pack
  handoff: Hand to courier
  answer: Answer the chase
}

systems: Systems {
  store: Storefront
  orders: Order service {shape: cylinder}
  wms: Warehouse system
  courier: Courier API
  support: Helpdesk
}

customer.browse -> systems.store
customer.checkout -> systems.orders
systems.orders -> systems.wms -> staff.pick -> staff.handoff -> systems.courier
systems.courier -> customer.waits: tracking

customer.chases -> systems.support -> staff.answer
staff.answer -> systems.orders: looks up
staff.answer -> systems.courier: looks up
`,
  },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}


export function templatesByCategory(): Array<{
  category: TemplateCategory;
  label: string;
  items: Template[];
}> {
  const order: TemplateCategory[] = [
    "architecture",
    "behaviour",
    "data",
    "infrastructure",
    "people",
  ];

  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: TEMPLATES.filter((t) => t.category === category),
    }))
    .filter((group) => group.items.length > 0);
}
