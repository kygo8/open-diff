use serde::{Deserialize, Serialize};
use std::fmt;

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedImage {
    pub metadata: ImageMetadata,
    pub pixels: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImageDecodeError {
    UnsupportedOrInvalid(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelDiff {
    pub different_pixels: u64,
    pub bounding_rect: Option<ImageRect>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PixelDiffError {
    InvalidBufferLength {
        side: ImageSide,
        expected: usize,
        actual: usize,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ImageSide {
    Left,
    Right,
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

pub fn decode_image(bytes: &[u8]) -> Result<DecodedImage, ImageDecodeError> {
    let guessed_format = image::guess_format(bytes).ok();
    let decoded = image::load_from_memory(bytes)
        .map_err(|error| ImageDecodeError::UnsupportedOrInvalid(error.to_string()))?;
    let rgba = decoded.to_rgba8();
    let metadata = ImageMetadata::new(
        image_format_from_guess(guessed_format),
        rgba.width(),
        rgba.height(),
        ImageColorInfo {
            bits_per_channel: 8,
            channel_count: 4,
            has_alpha: true,
        },
    );

    Ok(DecodedImage {
        metadata,
        pixels: rgba.into_raw(),
    })
}

pub fn scan_pixel_differences(
    left: &[u8],
    right: &[u8],
    width: u32,
    height: u32,
) -> Result<PixelDiff, PixelDiffError> {
    let expected = expected_rgba_len(width, height);
    ensure_rgba_len(ImageSide::Left, left.len(), expected)?;
    ensure_rgba_len(ImageSide::Right, right.len(), expected)?;

    let mut min_x = width;
    let mut min_y = height;
    let mut max_x = 0;
    let mut max_y = 0;
    let mut different_pixels = 0_u64;

    for pixel_index in 0..(width * height) {
        let start = (pixel_index * 4) as usize;

        if left[start..start + 4] == right[start..start + 4] {
            continue;
        }

        let x = pixel_index % width;
        let y = pixel_index / width;

        different_pixels += 1;
        min_x = min_x.min(x);
        min_y = min_y.min(y);
        max_x = max_x.max(x);
        max_y = max_y.max(y);
    }

    let bounding_rect = if different_pixels > 0 {
        Some(ImageRect {
            x: min_x,
            y: min_y,
            width: max_x - min_x + 1,
            height: max_y - min_y + 1,
        })
    } else {
        None
    };

    Ok(PixelDiff {
        different_pixels,
        bounding_rect,
    })
}

fn expected_rgba_len(width: u32, height: u32) -> usize {
    (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4)
}

fn ensure_rgba_len(side: ImageSide, actual: usize, expected: usize) -> Result<(), PixelDiffError> {
    if actual == expected {
        return Ok(());
    }

    Err(PixelDiffError::InvalidBufferLength {
        side,
        expected,
        actual,
    })
}

fn image_format_from_guess(format: Option<image::ImageFormat>) -> ImageFormat {
    match format {
        Some(image::ImageFormat::Png) => ImageFormat::Png,
        Some(image::ImageFormat::Jpeg) => ImageFormat::Jpeg,
        Some(image::ImageFormat::WebP) => ImageFormat::WebP,
        _ => ImageFormat::Unknown,
    }
}

impl fmt::Display for ImageDecodeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedOrInvalid(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for ImageDecodeError {}

impl fmt::Display for PixelDiffError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidBufferLength {
                side,
                expected,
                actual,
            } => write!(
                formatter,
                "{side:?} image buffer length {actual} does not match expected RGBA length {expected}"
            ),
        }
    }
}

impl std::error::Error for PixelDiffError {}

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

    #[test]
    fn decodes_png_jpeg_and_webp_into_rgba_pixels() {
        for format in [
            image::ImageFormat::Png,
            image::ImageFormat::Jpeg,
            image::ImageFormat::WebP,
        ] {
            let encoded = encode_fixture_image(format);

            let decoded = decode_image(&encoded).expect("image should decode");

            assert_eq!(decoded.metadata.width, 2);
            assert_eq!(decoded.metadata.height, 1);
            assert_eq!(decoded.metadata.color.channel_count, 4);
            assert!(decoded.metadata.color.has_alpha);
            assert_eq!(decoded.pixels.len(), 8);
        }
    }

    #[test]
    fn rejects_invalid_image_bytes() {
        let error = decode_image(b"not an image").expect_err("invalid image should be rejected");

        assert!(matches!(error, ImageDecodeError::UnsupportedOrInvalid(_)));
    }

    #[test]
    fn scans_pixel_differences_and_reports_bounding_rect() {
        let left = rgba_image(4, 3, [10, 20, 30, 255]);
        let mut right = left.clone();
        set_pixel(&mut right, 2, 1, 4, [200, 20, 30, 255]);
        set_pixel(&mut right, 3, 2, 4, [10, 220, 30, 255]);

        let diff = scan_pixel_differences(&left, &right, 4, 3).expect("scan should work");

        assert_eq!(diff.different_pixels, 2);
        assert_eq!(
            diff.bounding_rect,
            Some(ImageRect {
                x: 2,
                y: 1,
                width: 2,
                height: 2,
            })
        );
    }

    #[test]
    fn reports_no_pixel_differences_for_equal_buffers() {
        let left = rgba_image(2, 2, [1, 2, 3, 255]);

        let diff = scan_pixel_differences(&left, &left, 2, 2).expect("scan should work");

        assert_eq!(diff.different_pixels, 0);
        assert_eq!(diff.bounding_rect, None);
    }

    #[test]
    fn rejects_pixel_diff_buffers_with_invalid_lengths() {
        let error = scan_pixel_differences(&[0, 0, 0, 255], &[0, 0, 0], 1, 1)
            .expect_err("invalid right buffer should be rejected");

        assert_eq!(
            error,
            PixelDiffError::InvalidBufferLength {
                side: ImageSide::Right,
                expected: 4,
                actual: 3,
            }
        );
    }

    fn encode_fixture_image(format: image::ImageFormat) -> Vec<u8> {
        let mut bytes = std::io::Cursor::new(Vec::new());

        if format == image::ImageFormat::Jpeg {
            image::RgbImage::from_raw(2, 1, vec![255, 0, 0, 0, 128, 255])
                .expect("fixture pixels should match dimensions")
                .write_to(&mut bytes, format)
                .expect("fixture image should encode");
        } else {
            image::RgbaImage::from_raw(2, 1, vec![255, 0, 0, 255, 0, 128, 255, 200])
                .expect("fixture pixels should match dimensions")
                .write_to(&mut bytes, format)
                .expect("fixture image should encode");
        }

        bytes.into_inner()
    }

    fn rgba_image(width: u32, height: u32, color: [u8; 4]) -> Vec<u8> {
        (0..width * height).flat_map(|_| color).collect()
    }

    fn set_pixel(buffer: &mut [u8], x: u32, y: u32, width: u32, color: [u8; 4]) {
        let index = ((y * width + x) * 4) as usize;
        buffer[index..index + 4].copy_from_slice(&color);
    }
}
