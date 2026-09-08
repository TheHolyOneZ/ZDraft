use std::sync::{Arc, OnceLock};

const FACES: &[&[u8]] = &[
    include_bytes!("../assets/fonts/Inter-Regular.ttf"),
    include_bytes!("../assets/fonts/Inter-Medium.ttf"),
    include_bytes!("../assets/fonts/Inter-SemiBold.ttf"),
    include_bytes!("../assets/fonts/JetBrainsMono-Regular.ttf"),
];

#[derive(Debug, thiserror::Error)]
pub enum VectorError {
    #[error("the diagram could not be read as SVG: {0}")]
    Svg(String),

    #[error("the diagram could not be converted: {0}")]
    Convert(String),
}

impl VectorError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Svg(_) => "vector.svg",
            Self::Convert(_) => "vector.convert",
        }
    }

    pub fn remedy(&self) -> String {
        match self {
            Self::Svg(_) => "Export as SVG with the text left alone, and report the diagram \
                 that did this — ZDraft generated markup its own vector writer could not \
                 read back."
                .into(),
            Self::Convert(_) => {
                "Export as PNG, or as SVG with the text left alone. The diagram itself is \
                 fine; only the conversion failed."
                    .into()
            }
        }
    }
}

pub type VectorResult<T> = std::result::Result<T, VectorError>;

fn fonts() -> Arc<fontdb::Database> {
    static FONTS: OnceLock<Arc<fontdb::Database>> = OnceLock::new();

    FONTS
        .get_or_init(|| {
            let mut db = fontdb::Database::new();
            for face in FACES {
                db.load_font_data(face.to_vec());
            }

            db.set_sans_serif_family("Inter");
            db.set_serif_family("Inter");
            db.set_cursive_family("Inter");
            db.set_fantasy_family("Inter");
            db.set_monospace_family("JetBrains Mono");

            Arc::new(db)
        })
        .clone()
}

const DPI: f32 = 72.0;

fn parse(svg: &str) -> VectorResult<usvg::Tree> {
    let options = usvg::Options {
        fontdb: fonts(),
        font_family: "Inter".to_string(),
        ..usvg::Options::default()
    };

    usvg::Tree::from_str(svg, &options).map_err(|e| VectorError::Svg(e.to_string()))
}

pub fn to_pdf(svg: &str) -> VectorResult<Vec<u8>> {
    let tree = parse(svg)?;

    svg2pdf::to_pdf(
        &tree,
        svg2pdf::ConversionOptions::default(),
        svg2pdf::PageOptions { dpi: DPI },
    )
    .map_err(|e| VectorError::Convert(e.to_string()))
}

pub fn outline_text(svg: &str) -> VectorResult<String> {
    Ok(parse(svg)?.to_string(&usvg::WriteOptions::default()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100">
        <rect x="10" y="10" width="180" height="80" fill="#12314F" stroke="#8AF0FF"/>
        <text x="100" y="55" text-anchor="middle" font-family="Inter" font-size="13" font-weight="600" fill="#EAF3FB">Orders</text>
    </svg>"##;

    #[test]
    fn writes_a_pdf() {
        let bytes = to_pdf(SVG).expect("converts");

        assert!(bytes.starts_with(b"%PDF-"), "not a PDF");
        assert!(bytes.len() > 400, "suspiciously small: {}", bytes.len());
    }

    #[test]
    fn draws_the_text_rather_than_dropping_it() {
        let with_text = to_pdf(SVG).expect("converts");
        let without = to_pdf(&SVG.replace("Orders", "")).expect("converts");

        assert!(
            with_text.len() > without.len() + 200,
            "the label does not seem to have been drawn: {} vs {}",
            with_text.len(),
            without.len()
        );
    }

    #[test]
    fn draws_a_label_asking_for_a_font_nobody_has() {
        let unknown = SVG.replace(
            r#"font-family="Inter""#,
            r#"font-family="Nonesuch Grotesk""#,
        );

        let with_text = to_pdf(&unknown).expect("converts");
        let without = to_pdf(&unknown.replace("Orders", "")).expect("converts");

        assert!(
            with_text.len() > without.len() + 200,
            "the label was dropped rather than substituted: {} vs {}",
            with_text.len(),
            without.len()
        );
    }

    #[test]
    fn refuses_markup_that_is_not_svg() {
        assert!(to_pdf("not an svg at all").is_err());
        assert!(outline_text("not an svg at all").is_err());
    }

    #[test]
    fn turns_text_into_paths() {
        let out = outline_text(SVG).expect("converts");

        assert!(!out.contains("<text"), "the text element survived");
        assert!(!out.contains("Orders"), "the label survived as characters");

        assert!(
            out.matches("<path").count() >= 2,
            "the label was dropped: {out}"
        );
        assert!(out.len() > SVG.len() * 2, "the outlines look empty: {out}");
    }

    #[test]
    fn writes_an_svg_that_can_be_read_back() {
        let out = outline_text(SVG).expect("converts");
        assert!(to_pdf(&out).is_ok(), "the outlined SVG did not parse");
    }

    #[test]
    fn sizes_the_page_to_the_diagram() {
        let bytes = to_pdf(SVG).expect("converts");
        let text = String::from_utf8_lossy(&bytes);

        assert!(
            text.contains("/MediaBox [0 0 200 100]"),
            "unexpected page box"
        );
    }
}
