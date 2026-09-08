import {
  setPlantUmlRunner,
  type PlantUmlRunner,
  type PlantUmlStatus,
} from "../core/engines/plantuml";
import { useSettingsStore } from "../store/useSettingsStore";
import { api, isTauri, type PlantUmlProbe } from "./tauri";


let cached: { jar: string | null; probe: PlantUmlProbe } | null = null;

export function forgetPlantUmlProbe(): void {
  cached = null;
}

export async function probePlantUml(force = false): Promise<PlantUmlProbe | null> {
  if (!isTauri()) return null;

  const jar = useSettingsStore.getState().plantumlJar || null;
  if (!force && cached && cached.jar === jar) return cached.probe;

  const probe = await api.plantumlProbe(jar);
  cached = { jar, probe };
  return probe;
}


function statusOf(probe: PlantUmlProbe | null): PlantUmlStatus {
  if (!probe) {
    return {
      ready: false,
      reason: "PlantUML needs the desktop app.",
      remedy: "Open this file in ZDraft rather than the browser preview.",
    };
  }

  if (!probe.java) {
    return {
      ready: false,
      reason: "Java is not installed, or not on the PATH.",
      remedy:
        "Install a Java runtime (JRE 8 or newer). PlantUML is a Java program and ZDraft does not bundle one — every other engine works without it.",
    };
  }

  if (!probe.jar) {
    return {
      ready: false,
      reason: "Java is installed, but ZDraft could not find plantuml.jar.",
      remedy:
        "Download plantuml.jar from plantuml.com and set its path in Settings, or install your distribution's plantuml package.",
    };
  }

  if (!probe.version) {
    return {
      ready: false,
      reason: `${probe.jar} did not run as PlantUML.`,
      remedy: "Point Settings at the plantuml.jar file itself, and check it is not truncated.",
    };
  }

  return { ready: true, reason: "", remedy: "" };
}

export async function plantUmlStatus(force = false): Promise<PlantUmlStatus> {
  return statusOf(await probePlantUml(force));
}

const runner: PlantUmlRunner = {
  async render(source, skinparams) {
    const jar = useSettingsStore.getState().plantumlJar || null;
    return api.plantumlRender(source, jar, [...skinparams]);
  },

  async status() {
    return plantUmlStatus();
  },

  parse(svg) {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");


    if (doc.querySelector("parsererror")) return null;
    return doc.documentElement;
  },
};


export function installPlantUmlRunner(): void {
  setPlantUmlRunner(isTauri() ? runner : null);
}
