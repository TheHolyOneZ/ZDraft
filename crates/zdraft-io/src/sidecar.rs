use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use toml_edit::{value, Array, DocumentMut, Item, Table};
use ts_rs::TS;

use crate::error::{IoError, Result};

pub const SIDECAR_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Pin {
    pub x: f64,
    pub y: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto: Option<[f64; 2]>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EdgeHint {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub waypoints: Vec<[f64; 2]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_offset: Option<[f64; 2]>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
pub enum AnnotationKind {
    Note,

    Arrow,

    Highlight,

    Stroke,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Annotation {
    pub kind: AnnotationKind,

    pub at: [f64; 2],

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<[f64; 2]>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<[f64; 2]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub anchor: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SequenceHints {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lifeline_order: Vec<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub lifeline_gap: BTreeMap<String, f64>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub message_gap: BTreeMap<String, f64>,
}

impl SequenceHints {
    pub fn is_empty(&self) -> bool {
        self.lifeline_order.is_empty()
            && self.lifeline_gap.is_empty()
            && self.message_gap.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ThemeRef {
    pub name: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Layout {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<ThemeRef>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub pins: BTreeMap<String, Pin>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub edges: BTreeMap<String, EdgeHint>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sequence: Option<SequenceHints>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub annotations: BTreeMap<String, Annotation>,
}

impl Layout {
    pub fn is_empty(&self) -> bool {
        self.pins.is_empty()
            && self.edges.is_empty()
            && self.annotations.is_empty()
            && self.sequence.as_ref().is_none_or(SequenceHints::is_empty)
            && self.theme.is_none()
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Sidecar {
    pub version: u32,

    #[serde(flatten)]
    pub root: Layout,

    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub blocks: BTreeMap<String, Layout>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            version: SIDECAR_VERSION,
            ..Default::default()
        }
    }

    pub fn is_empty(&self) -> bool {
        self.root.is_empty() && self.blocks.values().all(Layout::is_empty)
    }
}

pub fn sidecar_path_for(diagram: impl AsRef<Path>) -> PathBuf {
    let diagram = diagram.as_ref();
    let name = diagram
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    diagram.with_file_name(format!("{name}.zlayout.toml"))
}

pub fn is_sidecar(path: impl AsRef<Path>) -> bool {
    path.as_ref()
        .file_name()
        .map(|n| n.to_string_lossy().ends_with(".zlayout.toml"))
        .unwrap_or(false)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct Conflict {
    pub ours_label: String,
    pub theirs_label: String,
    pub ours: String,
    pub theirs: String,
    pub line: usize,
}

pub fn detect_conflict(text: &str) -> Option<Conflict> {
    let start = text.lines().position(|l| l.starts_with("<<<<<<<"))?;

    let mut ours = Vec::new();
    let mut theirs = Vec::new();
    let mut ours_label = String::new();
    let mut theirs_label = String::new();
    let mut section = 0u8;

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("<<<<<<<") {
            ours_label = rest.trim().to_string();
            section = 1;
        } else if line.starts_with("|||||||") {
            section = 2;
        } else if line.starts_with("=======") && section != 0 {
            section = 3;
        } else if let Some(rest) = line.strip_prefix(">>>>>>>") {
            theirs_label = rest.trim().to_string();
            section = 0;
        } else {
            match section {
                0 => {
                    ours.push(line);
                    theirs.push(line);
                }
                1 => ours.push(line),
                3 => theirs.push(line),
                _ => {}
            }
        }
    }

    Some(Conflict {
        ours_label: if ours_label.is_empty() {
            "ours".into()
        } else {
            ours_label
        },
        theirs_label: if theirs_label.is_empty() {
            "theirs".into()
        } else {
            theirs_label
        },
        ours: ours.join("\n"),
        theirs: theirs.join("\n"),
        line: start + 1,
    })
}

pub fn parse(text: &str, path: impl AsRef<Path>) -> Result<Sidecar> {
    let path = path.as_ref();

    if let Some(c) = detect_conflict(text) {
        return Err(IoError::Parse {
            path: path.to_path_buf(),
            message: format!(
                "unresolved merge conflict at line {} ({} vs {})",
                c.line, c.ours_label, c.theirs_label
            ),
        });
    }

    let mut sidecar: Sidecar = toml::from_str(text).map_err(|e| IoError::Parse {
        path: path.to_path_buf(),
        message: e.message().to_string(),
    })?;

    if sidecar.version == 0 {
        sidecar.version = SIDECAR_VERSION;
    }

    Ok(sidecar)
}

pub fn to_toml_string(sidecar: &Sidecar, existing: Option<&str>) -> String {
    let mut doc = existing
        .filter(|t| detect_conflict(t).is_none())
        .and_then(|t| t.parse::<DocumentMut>().ok())
        .unwrap_or_default();

    doc["version"] = value(sidecar.version as i64);

    write_layout(doc.as_table_mut(), &sidecar.root);

    if sidecar.blocks.is_empty() {
        doc.remove("blocks");
    } else {
        let blocks = ensure_table(doc.as_table_mut(), "blocks");
        retain_keys(blocks, &sidecar.blocks.keys().cloned().collect::<Vec<_>>());
        for (id, layout) in &sidecar.blocks {
            let table = ensure_table(blocks, id);
            write_layout(table, layout);
        }
    }

    let mut out = doc.to_string();
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn write_layout(table: &mut Table, layout: &Layout) {
    set_or_remove_str(table, "engine", layout.engine.as_deref());

    if layout.pins.is_empty() {
        table.remove("pins");
    } else {
        let pins = ensure_table(table, "pins");
        retain_keys(pins, &layout.pins.keys().cloned().collect::<Vec<_>>());
        for (id, pin) in &layout.pins {
            let entry = ensure_table(pins, id);

            entry["x"] = value(pin.x.round() as i64);
            entry["y"] = value(pin.y.round() as i64);
            set_or_remove_str(entry, "fingerprint", pin.fingerprint.as_deref());
            match pin.auto {
                Some(at) => entry["auto"] = value(point_array(at)),
                None => {
                    entry.remove("auto");
                }
            }
        }
    }

    if layout.edges.is_empty() {
        table.remove("edges");
    } else {
        let edges = ensure_table(table, "edges");
        retain_keys(edges, &layout.edges.keys().cloned().collect::<Vec<_>>());
        for (id, hint) in &layout.edges {
            let entry = ensure_table(edges, id);
            if hint.waypoints.is_empty() {
                entry.remove("waypoints");
            } else {
                entry["waypoints"] = value(points_array(&hint.waypoints));
            }
            match hint.label_offset {
                Some(off) => entry["label_offset"] = value(point_array(off)),
                None => {
                    entry.remove("label_offset");
                }
            }
        }
    }

    if layout.annotations.is_empty() {
        table.remove("annotations");
    } else {
        let notes = ensure_table(table, "annotations");
        retain_keys(
            notes,
            &layout.annotations.keys().cloned().collect::<Vec<_>>(),
        );
        for (id, note) in &layout.annotations {
            let entry = ensure_table(notes, id);
            entry["kind"] = value(kind_name(note.kind));
            entry["at"] = value(point_array(note.at));

            match note.size {
                Some(size) => entry["size"] = value(point_array(size)),
                None => {
                    entry.remove("size");
                }
            }
            if note.points.is_empty() {
                entry.remove("points");
            } else {
                entry["points"] = value(points_array(&note.points));
            }
            set_or_remove_str(entry, "text", note.text.as_deref());
            set_or_remove_str(entry, "color", note.color.as_deref());
            set_or_remove_str(entry, "anchor", note.anchor.as_deref());
        }
    }

    match layout.sequence.as_ref().filter(|s| !s.is_empty()) {
        None => {
            table.remove("sequence");
        }
        Some(seq) => {
            let entry = ensure_table(table, "sequence");

            if seq.lifeline_order.is_empty() {
                entry.remove("lifeline_order");
            } else {
                let mut arr = Array::new();
                for id in &seq.lifeline_order {
                    arr.push(id.as_str());
                }
                entry["lifeline_order"] = value(arr);
            }

            write_gap_table(entry, "lifeline_gap", &seq.lifeline_gap);
            write_gap_table(entry, "message_gap", &seq.message_gap);
        }
    }

    match layout.theme.as_ref() {
        None => {
            table.remove("theme");
        }
        Some(theme) => {
            let entry = ensure_table(table, "theme");
            entry["name"] = value(theme.name.as_str());
        }
    }
}

fn kind_name(kind: AnnotationKind) -> &'static str {
    match kind {
        AnnotationKind::Note => "note",
        AnnotationKind::Arrow => "arrow",
        AnnotationKind::Highlight => "highlight",
        AnnotationKind::Stroke => "stroke",
    }
}

fn write_gap_table(parent: &mut Table, key: &str, gaps: &BTreeMap<String, f64>) {
    if gaps.is_empty() {
        parent.remove(key);
        return;
    }
    let table = ensure_table(parent, key);
    retain_keys(table, &gaps.keys().cloned().collect::<Vec<_>>());
    for (id, gap) in gaps {
        table[id.as_str()] = value(gap.round() as i64);
    }
}

fn ensure_table<'a>(parent: &'a mut Table, key: &str) -> &'a mut Table {
    if !parent.contains_table(key) {
        let mut t = Table::new();

        t.set_implicit(true);
        parent.insert(key, Item::Table(t));
    }
    parent[key].as_table_mut().expect("just ensured a table")
}

fn retain_keys(table: &mut Table, keep: &[String]) {
    let stale: Vec<String> = table
        .iter()
        .map(|(k, _)| k.to_string())
        .filter(|k| !keep.iter().any(|w| w == k))
        .collect();
    for key in stale {
        table.remove(&key);
    }
}

fn set_or_remove_str(table: &mut Table, key: &str, v: Option<&str>) {
    match v {
        Some(s) => table[key] = value(s),
        None => {
            table.remove(key);
        }
    }
}

fn point_array(p: [f64; 2]) -> Array {
    let mut arr = Array::new();
    arr.push(p[0].round() as i64);
    arr.push(p[1].round() as i64);
    arr
}

fn points_array(points: &[[f64; 2]]) -> Array {
    let mut outer = Array::new();
    for p in points {
        outer.push(point_array(*p));
    }
    outer
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pin(x: f64, y: f64) -> Pin {
        Pin {
            x,
            y,
            fingerprint: None,
            auto: None,
        }
    }

    fn note(text: &str) -> Annotation {
        Annotation {
            kind: AnnotationKind::Note,
            at: [420.0, 180.0],
            size: Some([200.0, 72.0]),
            points: Vec::new(),
            text: Some(text.into()),
            color: Some("rose".into()),
            anchor: Some("api".into()),
        }
    }

    fn sample() -> Sidecar {
        let mut s = Sidecar::new();
        s.root.engine = Some("d2".into());
        s.root.theme = Some(ThemeRef {
            name: "Blueprint".into(),
        });
        s.root.pins.insert("api".into(), pin(412.0, 288.0));
        s.root.pins.insert("cache".into(), pin(760.0, 210.0));
        s.root.edges.insert(
            "gateway->api".into(),
            EdgeHint {
                waypoints: vec![[500.0, 240.0]],
                label_offset: None,
            },
        );
        s
    }

    #[test]
    fn round_trips() {
        let text = to_toml_string(&sample(), None);
        assert_eq!(parse(&text, "a.toml").unwrap(), sample());
    }

    #[test]
    fn parses_the_shape_documented_in_the_spec() {
        let text = r#"
version = 1
engine = "d2"
[pins.api]
x = 412
y = 288
[pins.cache]
x = 760
y = 210
[edges."gateway->api"]
waypoints = [[500, 240]]
[theme]
name = "Blueprint"
"#;
        let s = parse(text, "a.toml").unwrap();
        assert_eq!(s.root.pins["api"], pin(412.0, 288.0));
        assert_eq!(s.root.edges["gateway->api"].waypoints, vec![[500.0, 240.0]]);
        assert_eq!(s.root.theme.unwrap().name, "Blueprint");
    }

    #[test]
    fn coordinates_are_written_as_integers() {
        let mut s = Sidecar::new();
        s.root.pins.insert("a".into(), pin(411.99999, 288.4));

        let text = to_toml_string(&s, None);
        assert!(text.contains("x = 412"), "{text}");
        assert!(text.contains("y = 288"), "{text}");
        let floats: Vec<_> = text
            .lines()
            .filter(|l| l.contains(" = ") && l.contains('.'))
            .collect();
        assert!(
            floats.is_empty(),
            "no float should reach the file: {floats:?}"
        );
    }

    #[test]
    fn a_write_preserves_comments_a_user_added() {
        let existing = r#"# hand-placed so the gateway reads left-to-right
version = 1

[pins.api]
x = 412
y = 288
"#;
        let mut s = parse(existing, "a.toml").unwrap();
        s.root.pins.get_mut("api").unwrap().x = 500.0;

        let out = to_toml_string(&s, Some(existing));
        assert!(
            out.contains("# hand-placed so the gateway reads left-to-right"),
            "{out}"
        );
        assert!(out.contains("x = 500"), "{out}");
    }

    #[test]
    fn moving_one_pin_leaves_the_other_lines_untouched() {
        let existing = to_toml_string(&sample(), None);

        let mut moved = sample();
        moved.root.pins.get_mut("api").unwrap().y = 999.0;
        let out = to_toml_string(&moved, Some(&existing));

        let changed: Vec<_> = existing
            .lines()
            .zip(out.lines())
            .filter(|(a, b)| a != b)
            .map(|(a, b)| format!("{a} -> {b}"))
            .collect();

        assert_eq!(
            changed,
            vec!["y = 288 -> y = 999"],
            "only the moved coordinate may change"
        );
    }

    #[test]
    fn releasing_a_pin_removes_its_lines() {
        let existing = to_toml_string(&sample(), None);

        let mut released = sample();
        released.root.pins.remove("cache");
        let out = to_toml_string(&released, Some(&existing));

        assert!(!out.contains("[pins.cache]"), "{out}");
        assert!(out.contains("[pins.api]"), "{out}");
    }

    #[test]
    fn pins_are_written_sorted_so_two_people_produce_the_same_file() {
        let mut a = Sidecar::new();
        for id in ["zeta", "alpha", "mid"] {
            a.root.pins.insert(id.into(), pin(1.0, 2.0));
        }
        let mut b = Sidecar::new();
        for id in ["mid", "zeta", "alpha"] {
            b.root.pins.insert(id.into(), pin(1.0, 2.0));
        }

        assert_eq!(to_toml_string(&a, None), to_toml_string(&b, None));

        let text = to_toml_string(&a, None);
        let order: Vec<_> = text
            .lines()
            .filter_map(|l| l.strip_prefix("[pins.").and_then(|l| l.strip_suffix(']')))
            .collect();
        assert_eq!(order, ["alpha", "mid", "zeta"]);
    }

    #[test]
    fn file_always_ends_with_a_newline() {
        assert!(to_toml_string(&sample(), None).ends_with('\n'));
    }

    #[test]
    fn markdown_blocks_are_keyed_not_ordinal() {
        let mut s = Sidecar::new();
        let mut block = Layout {
            engine: Some("mermaid".into()),
            ..Default::default()
        };
        block.pins.insert("session".into(), pin(320.0, 140.0));
        s.blocks.insert("auth-flow".into(), block);

        let text = to_toml_string(&s, None);
        assert!(text.contains("[blocks.auth-flow]"), "{text}");
        assert!(text.contains("[blocks.auth-flow.pins.session]"), "{text}");
        assert_eq!(parse(&text, "README.md.zlayout.toml").unwrap(), s);
    }

    #[test]
    fn sequence_hints_round_trip() {
        let mut s = Sidecar::new();
        s.root.sequence = Some(SequenceHints {
            lifeline_order: vec!["user".into(), "api".into(), "db".into()],
            lifeline_gap: BTreeMap::from([("db".to_string(), 40.0)]),
            message_gap: BTreeMap::new(),
        });

        let text = to_toml_string(&s, None);
        assert!(
            text.contains(r#"lifeline_order = ["user", "api", "db"]"#),
            "{text}"
        );
        assert_eq!(parse(&text, "a.toml").unwrap(), s);
    }

    #[test]
    fn sidecar_path_keeps_the_original_extension() {
        assert_eq!(
            sidecar_path_for("/docs/architecture.d2"),
            PathBuf::from("/docs/architecture.d2.zlayout.toml")
        );

        assert_ne!(
            sidecar_path_for("/d/flows.mmd"),
            sidecar_path_for("/d/flows.d2")
        );
    }

    #[test]
    fn recognises_its_own_sidecars() {
        assert!(is_sidecar("/d/a.mmd.zlayout.toml"));
        assert!(!is_sidecar("/d/a.mmd"));
        assert!(!is_sidecar("/d/zlayout.toml.mmd"));
    }

    #[test]
    fn a_conflict_is_reported_as_a_conflict_not_a_syntax_error() {
        let text = "version = 1\n\
                    [pins.api]\n\
                    <<<<<<< HEAD\n\
                    x = 412\n\
                    =======\n\
                    x = 900\n\
                    >>>>>>> feature/gateway\n\
                    y = 288\n";

        let c = detect_conflict(text).expect("conflict should be detected");
        assert_eq!(c.ours_label, "HEAD");
        assert_eq!(c.theirs_label, "feature/gateway");
        assert!(c.ours.contains("x = 412"));
        assert!(c.theirs.contains("x = 900"));

        assert!(c.ours.contains("y = 288") && c.theirs.contains("y = 288"));

        let err = parse(text, "a.toml").unwrap_err();
        assert_eq!(err.code(), "io.parse");
        assert!(err.to_string().contains("merge conflict"), "{err}");
    }

    #[test]
    fn both_sides_of_a_conflict_parse_cleanly() {
        let text = "version = 1\n\
                    [pins.api]\n\
                    <<<<<<< HEAD\n\
                    x = 412\n\
                    y = 288\n\
                    =======\n\
                    x = 900\n\
                    y = 100\n\
                    >>>>>>> other\n";

        let c = detect_conflict(text).unwrap();
        assert_eq!(
            parse(&c.ours, "a").unwrap().root.pins["api"],
            pin(412.0, 288.0)
        );
        assert_eq!(
            parse(&c.theirs, "a").unwrap().root.pins["api"],
            pin(900.0, 100.0)
        );
    }

    #[test]
    fn diff3_base_section_is_not_offered_as_a_side() {
        let text = "version = 1\n\
                    <<<<<<< HEAD\n\
                    engine = \"d2\"\n\
                    ||||||| base\n\
                    engine = \"dot\"\n\
                    =======\n\
                    engine = \"mermaid\"\n\
                    >>>>>>> other\n";

        let c = detect_conflict(text).unwrap();
        assert!(c.ours.contains("d2") && !c.ours.contains("dot"));
        assert!(c.theirs.contains("mermaid") && !c.theirs.contains("dot"));
    }

    #[test]
    fn whole_sections_on_each_side_parse_into_comparable_documents() {
        let text = "version = 1\n\
                    \n\
                    <<<<<<< HEAD\n\
                    [pins.a]\n\
                    x = 100\n\
                    y = 100\n\
                    \n\
                    [pins.b]\n\
                    x = 300\n\
                    y = 100\n\
                    =======\n\
                    [pins.a]\n\
                    x = 100\n\
                    y = 100\n\
                    \n\
                    [pins.b]\n\
                    x = 300\n\
                    y = 400\n\
                    \n\
                    [pins.c]\n\
                    x = 600\n\
                    y = 400\n\
                    >>>>>>> feature/layout\n";

        let c = detect_conflict(text).unwrap();
        assert_eq!(c.ours_label, "HEAD");
        assert_eq!(c.theirs_label, "feature/layout");

        let ours = parse(&c.ours, "a").unwrap();
        let theirs = parse(&c.theirs, "a").unwrap();

        assert_eq!(ours.version, 1);
        assert_eq!(theirs.version, 1);

        assert_eq!(ours.root.pins["a"], theirs.root.pins["a"]);
        assert_ne!(ours.root.pins["b"], theirs.root.pins["b"]);
        assert!(!ours.root.pins.contains_key("c"));
        assert!(theirs.root.pins.contains_key("c"));
    }

    #[test]
    fn clean_files_report_no_conflict() {
        assert!(detect_conflict(&to_toml_string(&sample(), None)).is_none());
    }

    #[test]
    fn an_empty_sidecar_knows_it_is_empty() {
        assert!(Sidecar::new().is_empty());
        assert!(!sample().is_empty());
    }

    #[test]
    fn a_corrupt_file_names_the_path_and_offers_a_way_out() {
        let err = parse("this is not toml {{{", "/d/a.zlayout.toml").unwrap_err();
        assert!(err.to_string().contains("/d/a.zlayout.toml"));
        assert!(err.remedy().contains("Delete it"), "{}", err.remedy());
    }

    #[test]
    fn an_annotation_round_trips() {
        let mut before = sample();
        before
            .root
            .annotations
            .insert("a1".into(), note("why two writers here?"));

        let text = to_toml_string(&before, None);
        let after = parse(&text, "x.zlayout.toml").unwrap();

        assert_eq!(after.root.annotations, before.root.annotations);
    }

    #[test]
    fn a_stroke_keeps_its_points_relative_to_where_it_starts() {
        let mut side = Sidecar::new();
        side.root.annotations.insert(
            "ink".into(),
            Annotation {
                kind: AnnotationKind::Stroke,
                at: [100.0, 100.0],
                size: None,
                points: vec![[0.0, 0.0], [12.0, 4.0], [30.0, -6.0]],
                text: None,
                color: None,
                anchor: None,
            },
        );

        let text = to_toml_string(&side, None);

        assert!(text.contains("at = [100, 100]"), "{text}");
        assert!(
            text.contains("points = [[0, 0], [12, 4], [30, -6]]"),
            "{text}"
        );
    }

    #[test]
    fn deleting_the_last_annotation_removes_its_lines() {
        let mut side = Sidecar::new();
        side.root.annotations.insert("a1".into(), note("first"));
        let with = to_toml_string(&side, None);

        side.root.annotations.clear();
        let without = to_toml_string(&side, Some(&with));

        assert!(!without.contains("annotations"), "{without}");
        assert!(side.is_empty());
    }

    #[test]
    fn a_file_of_only_annotations_is_worth_keeping() {
        let mut side = Sidecar::new();
        side.root.annotations.insert("a1".into(), note("keep me"));

        assert!(!side.is_empty());
    }
}
