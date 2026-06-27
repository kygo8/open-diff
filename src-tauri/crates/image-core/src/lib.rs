use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub format: ImageFormat,
    pub width: u32,
    pub height: u32,
    pub color_depth_bits: u16,
    pub color: ImageColorInfo,
    pub exif: Vec<ImageExifField>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImageFormat {
    Png,
    Jpeg,
    WebP,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageColorInfo {
    pub bits_per_channel: u8,
    pub channel_count: u8,
    pub has_alpha: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageExifField {
    pub key: String,
    pub value: String,
}

impl ImageMetadata {
    pub fn new(format: ImageFormat, width: u32, height: u32, color: ImageColorInfo) -> Self {
        Self {
            format,
            width,
            height,
            color_depth_bits: u16::from(color.bits_per_channel) * u16::from(color.channel_count),
            color,
            exif: Vec::new(),
        }
    }

    pub fn with_exif(mut self, exif: Vec<ImageExifField>) -> Self {
        self.exif = exif;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_image_metadata_with_dimensions_color_depth_format_and_exif() {
        let metadata = ImageMetadata::new(
            ImageFormat::Png,
            1920,
            1080,
            ImageColorInfo {
                bits_per_channel: 8,
                channel_count: 4,
                has_alpha: true,
            },
        )
        .with_exif(vec![ImageExifField {
            key: "Orientation".to_owned(),
            value: "1".to_owned(),
        }]);

        assert_eq!(metadata.format, ImageFormat::Png);
        assert_eq!(metadata.width, 1920);
        assert_eq!(metadata.height, 1080);
        assert_eq!(metadata.color_depth_bits, 32);
        assert_eq!(metadata.color.bits_per_channel, 8);
        assert_eq!(metadata.color.channel_count, 4);
        assert!(metadata.color.has_alpha);
        assert_eq!(
            metadata.exif,
            vec![ImageExifField {
                key: "Orientation".to_owned(),
                value: "1".to_owned(),
            }]
        );
    }

    #[test]
    fn represents_unknown_image_format_for_detection_failures() {
        let metadata = ImageMetadata::new(
            ImageFormat::Unknown,
            1,
            1,
            ImageColorInfo {
                bits_per_channel: 16,
                channel_count: 3,
                has_alpha: false,
            },
        );

        assert_eq!(metadata.format, ImageFormat::Unknown);
        assert_eq!(metadata.color_depth_bits, 48);
        assert!(!metadata.color.has_alpha);
    }
}
