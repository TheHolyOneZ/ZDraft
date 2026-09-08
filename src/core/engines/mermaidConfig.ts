

export const MERMAID_VERSION = "11.17.2";


const FONT_SIZE = 13;
const FONT_FAMILY = "Inter, 'Inter Variable', 'Segoe UI', system-ui, sans-serif";

export const MERMAID_CONFIG = {
  startOnLoad: false,


  securityLevel: "loose",


  deterministicIds: true,
  deterministicIDSeed: "zdraft",

  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZE,


  htmlLabels: false,

  flowchart: { htmlLabels: false, useMaxWidth: false, padding: 8 },
  class: { htmlLabels: false, useMaxWidth: false },
  state: { htmlLabels: false, useMaxWidth: false },
  er: { useMaxWidth: false },
  sequence: { useMaxWidth: false, htmlLabels: false },
  gantt: { useMaxWidth: false },
  pie: { useMaxWidth: false },


  theme: "base",
} as const;


export const FIXTURE_NAMES = [
  "flowchart-lr",
  "flowchart-td",
  "state",
  "class",
  "er",
  "sequence",
  "pie",
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];


export function mermaidThemeVariables(theme: {
  background: string;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  nodeTextMuted: string;
  edge: string;
  edgeText: string;
  clusterFill: string;
  clusterStroke: string;
  accent: string;
  fontFamily: string;
  fontSize: number;
}): Record<string, string> {
  return {
    background: theme.background,
    primaryColor: theme.nodeFill,
    primaryBorderColor: theme.nodeStroke,
    primaryTextColor: theme.nodeText,
    secondaryColor: theme.clusterFill,
    secondaryBorderColor: theme.clusterStroke,
    secondaryTextColor: theme.nodeTextMuted,
    tertiaryColor: theme.clusterFill,
    tertiaryBorderColor: theme.clusterStroke,
    tertiaryTextColor: theme.nodeTextMuted,

    lineColor: theme.edge,
    textColor: theme.nodeText,
    mainBkg: theme.nodeFill,
    nodeBorder: theme.nodeStroke,
    nodeTextColor: theme.nodeText,
    clusterBkg: theme.clusterFill,
    clusterBorder: theme.clusterStroke,
    edgeLabelBackground: theme.background,


    actorBkg: theme.nodeFill,
    actorBorder: theme.nodeStroke,
    actorTextColor: theme.nodeText,
    actorLineColor: theme.edge,
    signalColor: theme.edge,
    signalTextColor: theme.edgeText,
    labelBoxBkgColor: theme.nodeFill,
    labelBoxBorderColor: theme.nodeStroke,
    labelTextColor: theme.nodeText,
    loopTextColor: theme.edgeText,
    activationBkgColor: theme.accent,
    activationBorderColor: theme.nodeStroke,
    noteBkgColor: theme.clusterFill,
    noteBorderColor: theme.clusterStroke,
    noteTextColor: theme.nodeText,
    sequenceNumberColor: theme.background,

    fontFamily: theme.fontFamily,
    fontSize: `${theme.fontSize}px`,
  };
}
