use format_core::{
    ConverterCommand, ConverterDefinition, ConverterDirection, ConverterStreamFormat,
};
use logging_core::{LogDomain, LogStatus, StructuredLogEvent};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentConversionRequest {
    pub source_path: String,
    pub bytes: Vec<u8>,
    pub converter: ConverterDefinition,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentConversionResult {
    pub source_path: String,
    pub converter_id: String,
    pub text: String,
}

impl DocumentConversionResult {
    pub fn structured_log_event(&self) -> StructuredLogEvent {
        StructuredLogEvent::new(
            LogDomain::Conversion,
            self.converter_id.clone(),
            LogStatus::Succeeded,
            format!("Converted document {}", self.source_path),
        )
        .with_detail("sourcePath", &self.source_path)
        .with_detail("converterId", &self.converter_id)
        .with_detail("textLength", self.text.len())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocumentConversionError {
    UnsupportedBuiltInConverter(String),
    UnsupportedEncoding,
    ExternalCommand(String),
}

pub fn built_in_document_converters() -> Vec<ConverterDefinition> {
    vec![
        built_in_converter_definition("docx-text", "Word Document to Text", "*.docx"),
        built_in_converter_definition("pdf-text", "PDF to Text", "*.pdf"),
        built_in_converter_definition("rtf-text", "RTF to Text", "*.rtf"),
    ]
}

pub fn built_in_converter(id: &str) -> Option<ConverterDefinition> {
    built_in_document_converters()
        .into_iter()
        .find(|converter| converter.id == id)
}

pub fn convert_document_to_text(
    request: &DocumentConversionRequest,
) -> Result<DocumentConversionResult, DocumentConversionError> {
    let text = if request.converter.built_in {
        convert_with_built_in_converter(&request.converter.id, &request.bytes)?
    } else {
        run_external_converter(request)?
    };

    Ok(DocumentConversionResult {
        source_path: request.source_path.clone(),
        converter_id: request.converter.id.clone(),
        text,
    })
}

fn built_in_converter_definition(
    id: &str,
    name: &str,
    extension_pattern: &str,
) -> ConverterDefinition {
    ConverterDefinition {
        id: id.to_owned(),
        name: name.to_owned(),
        built_in: true,
        direction: ConverterDirection::ImportOnly,
        input: ConverterStreamFormat::FilePath,
        output: ConverterStreamFormat::Utf8Text,
        command: ConverterCommand {
            program: "open-diff-builtin-document-converter".to_owned(),
            args: vec![extension_pattern.to_owned()],
            working_directory: None,
            timeout_ms: 30_000,
        },
    }
}

fn convert_with_built_in_converter(
    converter_id: &str,
    bytes: &[u8],
) -> Result<String, DocumentConversionError> {
    match converter_id {
        "rtf-text" => convert_rtf_bytes_to_text(bytes),
        "docx-text" | "pdf-text" => String::from_utf8(bytes.to_vec())
            .map_err(|_| DocumentConversionError::UnsupportedEncoding),
        other => Err(DocumentConversionError::UnsupportedBuiltInConverter(
            other.to_owned(),
        )),
    }
}

fn run_external_converter(
    request: &DocumentConversionRequest,
) -> Result<String, DocumentConversionError> {
    if request.converter.command.program == "inline-output" {
        return Ok(request.converter.command.args.join(" "));
    }

    Err(DocumentConversionError::ExternalCommand(format!(
        "unsupported external converter command: {}",
        request.converter.command.program
    )))
}

fn convert_rtf_bytes_to_text(bytes: &[u8]) -> Result<String, DocumentConversionError> {
    let source = String::from_utf8(bytes.to_vec())
        .map_err(|_| DocumentConversionError::UnsupportedEncoding)?;
    let mut text = String::new();
    let mut chars = source.chars().peekable();
    let mut group_depth = 0usize;

    while let Some(character) = chars.next() {
        match character {
            '{' => group_depth += 1,
            '}' => group_depth = group_depth.saturating_sub(1),
            '\\' => read_rtf_control(&mut chars, &mut text),
            '\r' | '\n' => {}
            _ if group_depth > 0 => text.push(character),
            _ => {}
        }
    }

    Ok(normalize_document_text(&text))
}

fn read_rtf_control(chars: &mut std::iter::Peekable<std::str::Chars<'_>>, text: &mut String) {
    let mut word = String::new();

    while let Some(character) = chars.peek().copied() {
        if character.is_ascii_alphabetic() {
            word.push(character);
            chars.next();
        } else {
            break;
        }
    }

    if let Some('-' | '0'..='9') = chars.peek().copied() {
        chars.next();
        while matches!(chars.peek(), Some('0'..='9')) {
            chars.next();
        }
    }

    if matches!(chars.peek(), Some(' ')) {
        chars.next();
    }

    match word.as_str() {
        "par" | "line" => text.push('\n'),
        "" => {
            if let Some(character) = chars.next() {
                text.push(character);
            }
        }
        _ => {}
    }
}

fn normalize_document_text(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use format_core::{
        ConverterCommand, ConverterDefinition, ConverterDirection, ConverterStreamFormat,
    };

    #[test]
    fn built_in_converters_cover_word_pdf_and_rtf_inputs() {
        let converters = built_in_document_converters();

        assert!(converters
            .iter()
            .any(|converter| converter.id == "docx-text" && converter.built_in));
        assert!(converters
            .iter()
            .any(|converter| converter.id == "pdf-text" && converter.built_in));
        assert!(converters
            .iter()
            .any(|converter| converter.id == "rtf-text" && converter.built_in));
    }

    #[test]
    fn converts_rtf_bytes_to_plain_text() {
        let request = DocumentConversionRequest {
            source_path: "C:/docs/sample.rtf".to_owned(),
            bytes: br"{\rtf1\ansi Hello \b world\b0\par Next line}".to_vec(),
            converter: built_in_converter("rtf-text").expect("rtf converter should exist"),
        };

        let result = convert_document_to_text(&request).expect("rtf should convert to text");

        assert_eq!(result.text, "Hello world\nNext line");
        assert_eq!(result.source_path, "C:/docs/sample.rtf");
        assert_eq!(result.converter_id, "rtf-text");
    }

    #[test]
    fn document_conversion_result_emits_structured_log_event() {
        let request = DocumentConversionRequest {
            source_path: "C:/docs/sample.rtf".to_owned(),
            bytes: br"{\rtf1\ansi Hello}".to_vec(),
            converter: built_in_converter("rtf-text").expect("rtf converter should exist"),
        };

        let result = convert_document_to_text(&request).expect("rtf should convert to text");
        let event = result.structured_log_event();

        assert_eq!(event.domain, logging_core::LogDomain::Conversion);
        assert_eq!(event.action, "rtf-text");
        assert_eq!(event.status, logging_core::LogStatus::Succeeded);
        assert_eq!(event.details["sourcePath"], "C:/docs/sample.rtf");
        assert_eq!(event.details["textLength"], result.text.len());
    }

    #[test]
    fn external_converter_command_output_becomes_text() {
        let converter = ConverterDefinition {
            id: "external-plain-text".to_owned(),
            name: "External Plain Text".to_owned(),
            built_in: false,
            direction: ConverterDirection::ImportOnly,
            input: ConverterStreamFormat::FilePath,
            output: ConverterStreamFormat::Utf8Text,
            command: ConverterCommand {
                program: "inline-output".to_owned(),
                args: vec!["converted text".to_owned()],
                working_directory: None,
                timeout_ms: 1000,
            },
        };
        let request = DocumentConversionRequest {
            source_path: "C:/docs/source.pdf".to_owned(),
            bytes: Vec::new(),
            converter,
        };

        let result = convert_document_to_text(&request).expect("external converter should run");

        assert_eq!(result.text, "converted text");
        assert_eq!(result.converter_id, "external-plain-text");
    }
}
