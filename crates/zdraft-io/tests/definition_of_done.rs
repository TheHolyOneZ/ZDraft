use std::collections::BTreeMap;

use zdraft_io::sidecar::{parse, to_toml_string};
use zdraft_io::{read_text, sidecar_path_for, write_atomic, Pin, Sidecar};

fn forty_node_diagram() -> String {
    let mut src = String::from("flowchart LR\n");
    for i in 0..40 {
        src.push_str(&format!("  n{i}[Service {i}]\n"));
    }
    for i in 0..39 {
        src.push_str(&format!("  n{i} --> n{}\n", i + 1));
    }
    src
}

#[test]
fn the_definition_of_done() {
    let dir = tempfile::tempdir().unwrap();
    let diagram = dir.path().join("architecture.mmd");

    let original = forty_node_diagram();
    std::fs::write(&diagram, &original).unwrap();
    let original_bytes = std::fs::read(&diagram).unwrap();

    let mut sidecar = Sidecar::new();
    sidecar.root.engine = Some("mermaid".into());
    let moved: BTreeMap<&str, (f64, f64)> = BTreeMap::from([
        ("n3", (412.0, 288.0)),
        ("n11", (760.0, 210.0)),
        ("n24", (188.0, 640.0)),
        ("n37", (930.0, 512.0)),
    ]);
    for (id, (x, y)) in &moved {
        sidecar.root.pins.insert(
            (*id).to_string(),
            Pin {
                x: *x,
                y: *y,
                fingerprint: Some(format!("node:Service:{id}")),
                auto: None,
            },
        );
    }

    let path = sidecar_path_for(&diagram);
    write_atomic(&path, &to_toml_string(&sidecar, None)).unwrap();

    assert_eq!(
        std::fs::read(&diagram).unwrap(),
        original_bytes,
        "pinning must never rewrite the diagram source"
    );

    let written = read_text(&path).unwrap();
    assert!(
        written.len() < 700,
        "sidecar for four pins should be small, was {} bytes:\n{written}",
        written.len()
    );

    assert!(written.contains("[pins.n3]"), "{written}");
    assert!(written.contains("x = 412"), "{written}");
    assert!(
        !written
            .lines()
            .any(|l| l.contains(" = ") && l.contains('.')),
        "coordinates must be integers so a merge conflict stays readable:\n{written}"
    );
    assert!(written.ends_with('\n'));

    let reopened = parse(&read_text(&path).unwrap(), &path).unwrap();
    assert_eq!(
        reopened, sidecar,
        "what was written must come back identical"
    );

    for (id, (x, y)) in &moved {
        let pin = &reopened.root.pins[*id];
        assert_eq!(
            (pin.x, pin.y),
            (*x, *y),
            "pin {id} moved across a save/load"
        );
    }
}

#[test]
fn deleting_the_sidecar_returns_pure_auto_layout() {
    let dir = tempfile::tempdir().unwrap();
    let diagram = dir.path().join("a.mmd");
    std::fs::write(&diagram, "flowchart TD\n  a --> b\n").unwrap();

    let path = sidecar_path_for(&diagram);
    let mut sidecar = Sidecar::new();
    sidecar.root.pins.insert(
        "a".into(),
        Pin {
            x: 1.0,
            y: 2.0,
            fingerprint: None,
            auto: None,
        },
    );
    write_atomic(&path, &to_toml_string(&sidecar, None)).unwrap();

    std::fs::remove_file(&path).unwrap();

    assert!(!path.exists());
    assert_eq!(read_text(&diagram).unwrap(), "flowchart TD\n  a --> b\n");
}

#[test]
fn a_second_drag_rewrites_only_the_lines_that_moved() {
    let dir = tempfile::tempdir().unwrap();
    let diagram = dir.path().join("a.mmd");
    let path = sidecar_path_for(&diagram);

    let mut sidecar = Sidecar::new();
    for (id, x, y) in [("a", 10.0, 20.0), ("b", 30.0, 40.0), ("c", 50.0, 60.0)] {
        sidecar.root.pins.insert(
            id.into(),
            Pin {
                x,
                y,
                fingerprint: None,
                auto: None,
            },
        );
    }
    let first = to_toml_string(&sidecar, None);
    write_atomic(&path, &first).unwrap();

    let annotated = first.replace(
        "[pins.b]",
        "# b sits left of the gateway on purpose\n[pins.b]",
    );
    write_atomic(&path, &annotated).unwrap();

    sidecar.root.pins.get_mut("c").unwrap().y = 999.0;
    let after = to_toml_string(&sidecar, Some(&read_text(&path).unwrap()));
    write_atomic(&path, &after).unwrap();

    let text = read_text(&path).unwrap();
    assert!(
        text.contains("# b sits left of the gateway on purpose"),
        "a hand-written comment must survive a later drag:\n{text}"
    );

    let changed: Vec<_> = annotated
        .lines()
        .zip(text.lines())
        .filter(|(a, b)| a != b)
        .collect();
    assert_eq!(
        changed.len(),
        1,
        "only c's y should differ, got {changed:?}"
    );
}

#[test]
fn the_writer_still_produces_the_fixture_the_cli_reads() {
    use std::collections::BTreeMap;
    use zdraft_io::sidecar::{
        to_toml_string, Annotation, AnnotationKind, EdgeHint, Pin, SequenceHints, Sidecar, ThemeRef,
    };

    let mut side = Sidecar::new();
    side.root.theme = Some(ThemeRef {
        name: "Blueprint".into(),
    });
    side.root.pins.insert(
        "api".into(),
        Pin {
            x: 412.0,
            y: 288.0,
            fingerprint: Some("box:API:0".into()),
            auto: Some([120.0, 40.0]),
        },
    );
    side.root.pins.insert(
        "cache".into(),
        Pin {
            x: 760.0,
            y: 210.0,
            fingerprint: None,
            auto: None,
        },
    );
    side.root.edges.insert(
        "gateway->api".into(),
        EdgeHint {
            waypoints: vec![[500.0, 240.0], [520.0, 260.0]],
            label_offset: Some([4.0, -8.0]),
        },
    );
    side.root.annotations.insert(
        "a1".into(),
        Annotation {
            kind: AnnotationKind::Note,
            at: [631.0, 185.0],
            size: Some([190.0, 68.0]),
            points: Vec::new(),
            text: Some("why two writers?".into()),
            color: Some("rose".into()),
            anchor: Some("api".into()),
        },
    );
    side.root.sequence = Some(SequenceHints {
        lifeline_order: vec!["browser".into(), "api".into()],
        lifeline_gap: BTreeMap::from([("api".to_string(), 40.0)]),
        message_gap: BTreeMap::new(),
    });

    let written = to_toml_string(&side, None);
    let fixture = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../tests/fixtures/sidecar/full.zlayout.toml");

    if std::env::var("ZDRAFT_BLESS").is_ok() {
        std::fs::create_dir_all(fixture.parent().unwrap()).unwrap();
        std::fs::write(&fixture, &written).unwrap();
    }

    let expected = std::fs::read_to_string(&fixture)
        .expect("tests/fixtures/sidecar/full.zlayout.toml — run with ZDRAFT_BLESS=1 to write it");

    assert_eq!(
        written, expected,
        "the sidecar format changed; re-run with ZDRAFT_BLESS=1 and check read.test.ts still passes"
    );
}
