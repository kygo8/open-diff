use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug)]
pub struct S3NetworkProvider {
    agent: ureq::Agent,
    access_key: String,
    secret_key: String,
    bucket: String,
    region: String,
    endpoint_host: String,
    path_style: bool,
    use_https: bool,
}

impl S3NetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::S3 {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let bucket = resolve_s3_bucket(profile)?;
        let access_key = credential
            .username
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RemoteProviderError::Backend(
                    "S3 requires an access key id in the username field".to_owned(),
                )
            })?
            .to_owned();
        let secret_key = match &credential.material {
            RemoteCredentialMaterial::Password(secret) => secret.expose_secret().to_owned(),
            _ => {
                return Err(RemoteProviderError::Backend(
                    "S3 requires a secret access key password credential".to_owned(),
                ))
            }
        };

        let region = resolve_s3_region(profile);
        let endpoint_host = resolve_s3_endpoint_host(profile);
        let path_style = resolve_s3_path_style(profile, &endpoint_host);
        let use_https = resolve_s3_https(profile);
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(8))
            .timeout_read(Duration::from_secs(30))
            .timeout_write(Duration::from_secs(30))
            .build();

        Ok(Self {
            agent,
            access_key,
            secret_key,
            bucket,
            region,
            endpoint_host,
            path_style,
            use_https,
        })
    }

    pub fn bucket(&self) -> &str {
        &self.bucket
    }

    pub fn region(&self) -> &str {
        &self.region
    }

    pub fn path_style(&self) -> bool {
        self.path_style
    }

    fn object_key(path: &str) -> RemoteProviderResult<String> {
        let normalized = normalize_remote_path(path)?;
        if normalized == "/" {
            return Ok(String::new());
        }
        Ok(normalized.trim_start_matches('/').to_owned())
    }

    fn request_host(&self) -> String {
        if self.path_style {
            self.endpoint_host.clone()
        } else {
            format!("{}.{}", self.bucket, self.endpoint_host)
        }
    }

    fn object_url(&self, key: &str) -> String {
        let scheme = if self.use_https { "https" } else { "http" };
        let host = self.request_host();
        if self.path_style {
            if key.is_empty() {
                format!("{scheme}://{host}/{}", self.bucket)
            } else {
                format!(
                    "{scheme}://{host}/{}/{}",
                    self.bucket,
                    encode_path_segments(key)
                )
            }
        } else if key.is_empty() {
            format!("{scheme}://{host}/")
        } else {
            format!("{scheme}://{host}/{}", encode_path_segments(key))
        }
    }

    fn canonical_uri(&self, key: &str) -> String {
        if self.path_style {
            if key.is_empty() {
                format!("/{}", self.bucket)
            } else {
                format!("/{}/{}", self.bucket, encode_path_segments(key))
            }
        } else if key.is_empty() {
            "/".to_owned()
        } else {
            format!("/{}", encode_path_segments(key))
        }
    }

    fn signed_request(
        &self,
        method: &str,
        key: &str,
        query: &[(&str, &str)],
        payload: &[u8],
        extra_headers: &[(&str, &str)],
    ) -> RemoteProviderResult<ureq::Request> {
        let amz_date = amz_date_now()?;
        let date_stamp = &amz_date[..8];
        let payload_hash = hex_sha256(payload);
        let host = self.request_host();
        let canonical_uri = self.canonical_uri(key);
        let canonical_query = canonical_query_string(query);
        let mut headers: Vec<(String, String)> = vec![
            ("host".to_owned(), host.clone()),
            ("x-amz-content-sha256".to_owned(), payload_hash.clone()),
            ("x-amz-date".to_owned(), amz_date.clone()),
        ];
        for (name, value) in extra_headers {
            headers.push(((*name).to_ascii_lowercase(), (*value).to_owned()));
        }
        headers.sort_by(|left, right| left.0.cmp(&right.0));

        let signed_headers = headers
            .iter()
            .map(|(name, _)| name.as_str())
            .collect::<Vec<_>>()
            .join(";");
        let canonical_headers = headers
            .iter()
            .map(|(name, value)| format!("{name}:{}\n", value.trim()))
            .collect::<String>();
        let canonical_request = format!(
            "{method}\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        );
        let credential_scope = format!("{date_stamp}/{}/s3/aws4_request", self.region);
        let string_to_sign = format!(
            "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
            hex_sha256(canonical_request.as_bytes())
        );
        let signing_key = derive_signing_key(&self.secret_key, date_stamp, &self.region, "s3");
        let signature = hex_hmac_sha256(&signing_key, string_to_sign.as_bytes());
        let authorization = format!(
            "AWS4-HMAC-SHA256 Credential={}/{credential_scope}, SignedHeaders={signed_headers}, Signature={signature}",
            self.access_key
        );

        let mut url = self.object_url(key);
        if !canonical_query.is_empty() {
            url.push('?');
            url.push_str(&canonical_query);
        }

        let mut request = self
            .agent
            .request(method, &url)
            .set("Authorization", &authorization);
        for (name, value) in &headers {
            if name == "host" {
                continue;
            }
            request = request.set(name, value);
        }
        Ok(request)
    }

    fn map_response_error(path: &str, error: ureq::Error) -> RemoteProviderError {
        match error {
            ureq::Error::Status(404, _) => RemoteProviderError::NotFound(path.to_owned()),
            ureq::Error::Status(code, response) => {
                let body = response.into_string().unwrap_or_else(|_| String::new());
                RemoteProviderError::Backend(format!("S3 HTTP {code}: {body}"))
            }
            other => RemoteProviderError::Backend(other.to_string()),
        }
    }
}

impl RemoteFileProvider for S3NetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let normalized = normalize_remote_path(path)?;
        let prefix = if normalized == "/" {
            String::new()
        } else {
            format!(
                "{}/",
                normalized.trim_start_matches('/').trim_end_matches('/')
            )
        };
        let query = [
            ("delimiter", "/"),
            ("list-type", "2"),
            ("prefix", prefix.as_str()),
        ];
        let response = self
            .signed_request("GET", "", &query, b"", &[])?
            .call()
            .map_err(|error| Self::map_response_error(&normalized, error))?;
        let xml = response
            .into_string()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(parse_list_objects_v2(&xml, &normalized))
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let key = Self::object_key(path)?;
        if key.is_empty() {
            return Err(RemoteProviderError::InvalidPath(
                "S3 download requires an object key".to_owned(),
            ));
        }
        let response = self
            .signed_request("GET", &key, &[], b"", &[])?
            .call()
            .map_err(|error| Self::map_response_error(path, error))?;
        let mut bytes = Vec::new();
        response
            .into_reader()
            .read_to_end(&mut bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(bytes)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let key = Self::object_key(path)?;
        if key.is_empty() {
            return Err(RemoteProviderError::InvalidPath(
                "S3 upload requires an object key".to_owned(),
            ));
        }
        self.signed_request(
            "PUT",
            &key,
            &[],
            &bytes,
            &[("content-type", "application/octet-stream")],
        )?
        .set("Content-Type", "application/octet-stream")
        .send_bytes(&bytes)
        .map_err(|error| Self::map_response_error(path, error))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let key = Self::object_key(path)?;
        if key.is_empty() {
            return Err(RemoteProviderError::InvalidPath(
                "S3 delete requires an object key".to_owned(),
            ));
        }
        self.signed_request("DELETE", &key, &[], b"", &[])?
            .call()
            .map_err(|error| Self::map_response_error(path, error))?;
        Ok(())
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from_key = Self::object_key(from)?;
        let to_key = Self::object_key(to)?;
        if from_key.is_empty() || to_key.is_empty() {
            return Err(RemoteProviderError::InvalidPath(
                "S3 rename requires object keys".to_owned(),
            ));
        }
        let copy_source = format!("/{}/{}", self.bucket, from_key);
        self.signed_request(
            "PUT",
            &to_key,
            &[],
            b"",
            &[("x-amz-copy-source", &copy_source)],
        )?
        .call()
        .map_err(|error| Self::map_response_error(from, error))?;
        self.delete(from)
    }

    fn mkdir(&mut self, path: &str) -> RemoteProviderResult<()> {
        let key = Self::object_key(path)?;
        let placeholder = if key.is_empty() {
            return Ok(());
        } else if key.ends_with('/') {
            key
        } else {
            format!("{key}/")
        };
        self.signed_request("PUT", &placeholder, &[], b"", &[])?
            .send_bytes(b"")
            .map_err(|error| Self::map_response_error(path, error))?;
        Ok(())
    }
}

pub fn resolve_s3_bucket(profile: &RemoteProfile) -> RemoteProviderResult<String> {
    let bucket = profile
        .endpoint
        .root_path
        .as_deref()
        .map(str::trim)
        .map(|path| path.trim_matches('/'))
        .filter(|path| !path.is_empty())
        .map(|path| path.split('/').next().unwrap_or(path).to_owned())
        .ok_or_else(|| RemoteProviderError::InvalidPath("S3 bucket is required".to_owned()))?;
    if bucket.contains('/') {
        return Err(RemoteProviderError::InvalidPath(
            "S3 bucket must be a single path segment".to_owned(),
        ));
    }
    Ok(bucket)
}

pub fn resolve_s3_region(profile: &RemoteProfile) -> String {
    if let Some(region) = profile
        .options
        .get("region")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        return region.to_owned();
    }

    infer_region_from_host(&profile.endpoint.host).unwrap_or_else(|| "us-east-1".to_owned())
}

pub fn resolve_s3_endpoint_host(profile: &RemoteProfile) -> String {
    if let Some(endpoint) = profile
        .options
        .get("endpoint")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        return strip_scheme_and_path(endpoint);
    }

    let host = strip_scheme_and_path(profile.endpoint.host.trim());
    if host.is_empty() || host.eq_ignore_ascii_case("s3") {
        let region = resolve_s3_region(profile);
        if region == "us-east-1" {
            "s3.amazonaws.com".to_owned()
        } else {
            format!("s3.{region}.amazonaws.com")
        }
    } else {
        host
    }
}

pub fn resolve_s3_path_style(profile: &RemoteProfile, endpoint_host: &str) -> bool {
    if let Some(value) = profile.options.get("pathStyle") {
        return !value.eq_ignore_ascii_case("false") && value != "0";
    }
    !endpoint_host.to_ascii_lowercase().contains("amazonaws.com")
}

fn resolve_s3_https(profile: &RemoteProfile) -> bool {
    if let Some(value) = profile.options.get("useHttps") {
        return !value.eq_ignore_ascii_case("false") && value != "0";
    }
    profile.endpoint.port != Some(80)
}

fn infer_region_from_host(host: &str) -> Option<String> {
    let host = strip_scheme_and_path(host).to_ascii_lowercase();
    if host == "s3.amazonaws.com" {
        return Some("us-east-1".to_owned());
    }
    let rest = host.strip_prefix("s3.")?;
    let region = rest.strip_suffix(".amazonaws.com")?;
    if region.is_empty() {
        None
    } else {
        Some(region.to_owned())
    }
}

fn strip_scheme_and_path(value: &str) -> String {
    let without_scheme = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))
        .unwrap_or(value);
    without_scheme
        .split('/')
        .next()
        .unwrap_or(without_scheme)
        .split('@')
        .next_back()
        .unwrap_or(without_scheme)
        .to_owned()
}

fn amz_date_now() -> RemoteProviderResult<String> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
    Ok(format_amz_date(duration.as_secs()))
}

fn format_amz_date(epoch_secs: u64) -> String {
    let days = epoch_secs / 86_400;
    let time = epoch_secs % 86_400;
    let hour = time / 3_600;
    let minute = (time % 3_600) / 60;
    let second = time % 60;
    let (year, month, day) = civil_from_days(days as i64);
    format!("{year:04}{month:02}{day:02}T{hour:02}{minute:02}{second:02}Z")
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    // Algorithm from Howard Hinnant (public domain).
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

fn derive_signing_key(secret: &str, date_stamp: &str, region: &str, service: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret}").as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, service.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn hex_hmac_sha256(key: &[u8], data: &[u8]) -> String {
    to_hex(&hmac_sha256(key, data))
}

fn hex_sha256(data: &[u8]) -> String {
    to_hex(&Sha256::digest(data))
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn canonical_query_string(query: &[(&str, &str)]) -> String {
    let mut encoded = query
        .iter()
        .map(|(key, value)| format!("{}={}", uri_encode(key), uri_encode(value)))
        .collect::<Vec<_>>();
    encoded.sort();
    encoded.join("&")
}

fn encode_path_segments(path: &str) -> String {
    path.split('/')
        .map(uri_encode)
        .collect::<Vec<_>>()
        .join("/")
}

fn uri_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                out.push('%');
                out.push(to_hex(&[byte]).chars().next().unwrap());
                out.push(to_hex(&[byte]).chars().nth(1).unwrap());
            }
        }
    }
    out
}

fn parse_list_objects_v2(xml: &str, request_path: &str) -> Vec<RemoteEntry> {
    let mut entries = Vec::new();
    let request_prefix = if request_path == "/" {
        String::new()
    } else {
        format!(
            "{}/",
            request_path.trim_start_matches('/').trim_end_matches('/')
        )
    };

    for block in extract_xml_blocks(xml, "CommonPrefixes") {
        for prefix in extract_xml_tag_values(&block, "Prefix") {
            if prefix.is_empty() {
                continue;
            }
            let path = format!("/{}", prefix.trim_end_matches('/'));
            if entries.iter().any(|entry: &RemoteEntry| entry.path == path) {
                continue;
            }
            entries.push(RemoteEntry {
                path,
                kind: RemoteEntryKind::Directory,
                size: 0,
            });
        }
    }

    for block in extract_xml_blocks(xml, "Contents") {
        let key = extract_xml_tag_values(&block, "Key")
            .into_iter()
            .next()
            .unwrap_or_default();
        if key.is_empty() || key.ends_with('/') {
            continue;
        }
        if !request_prefix.is_empty() && !key.starts_with(&request_prefix) {
            continue;
        }
        let relative = key.strip_prefix(&request_prefix).unwrap_or(key.as_str());
        if relative.contains('/') {
            continue;
        }
        let size = extract_xml_tag_values(&block, "Size")
            .into_iter()
            .next()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(0);
        entries.push(RemoteEntry {
            path: format!("/{key}"),
            kind: RemoteEntryKind::File,
            size,
        });
    }

    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

fn extract_xml_blocks(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let mut blocks = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find(&open) {
        let after = &rest[start + open.len()..];
        let Some(end) = after.find(&close) else {
            break;
        };
        blocks.push(after[..end].to_owned());
        rest = &after[end + close.len()..];
    }
    blocks
}

fn extract_xml_tag_values(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let mut values = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find(&open) {
        let after = &rest[start + open.len()..];
        let Some(end) = after.find(&close) else {
            break;
        };
        values.push(after[..end].to_owned());
        rest = &after[end + close.len()..];
    }
    values
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};

    fn sample_profile() -> RemoteProfile {
        RemoteProfile::new(
            "release-s3",
            "Release S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("s3.us-west-2.amazonaws.com").with_root_path("open-diff-release"),
            CredentialReference::profile_store("release-s3"),
        )
        .with_option("region", "us-west-2")
    }

    #[test]
    fn resolves_bucket_region_endpoint_and_path_style() {
        let profile = sample_profile();
        assert_eq!(resolve_s3_bucket(&profile).unwrap(), "open-diff-release");
        assert_eq!(resolve_s3_region(&profile), "us-west-2");
        assert_eq!(
            resolve_s3_endpoint_host(&profile),
            "s3.us-west-2.amazonaws.com"
        );
        assert!(!resolve_s3_path_style(
            &profile,
            "s3.us-west-2.amazonaws.com"
        ));

        let minio = RemoteProfile::new(
            "minio",
            "MinIO",
            RemoteProtocol::S3,
            RemoteEndpoint::new("127.0.0.1")
                .with_port(9000)
                .with_root_path("demo"),
            CredentialReference::profile_store("minio"),
        )
        .with_option("region", "us-east-1")
        .with_option("useHttps", "false");
        assert!(resolve_s3_path_style(&minio, "127.0.0.1"));
        assert!(!resolve_s3_https(&minio));
    }

    #[test]
    fn rejects_missing_bucket() {
        let profile = RemoteProfile::new(
            "release-s3",
            "Release S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("s3.amazonaws.com"),
            CredentialReference::profile_store("release-s3"),
        );
        let error = resolve_s3_bucket(&profile).unwrap_err();
        assert!(matches!(
            error,
            RemoteProviderError::InvalidPath(message) if message == "S3 bucket is required"
        ));
    }

    #[test]
    fn parses_list_objects_response_into_files_and_prefixes() {
        let xml = r#"
        <ListBucketResult>
          <Prefix>builds/</Prefix>
          <CommonPrefixes><Prefix>builds/linux/</Prefix></CommonPrefixes>
          <Contents><Key>builds/app.zip</Key><Size>7</Size></Contents>
          <Contents><Key>builds/notes.txt</Key><Size>4</Size></Contents>
        </ListBucketResult>
        "#;
        let entries = parse_list_objects_v2(xml, "/builds");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].path, "/builds/app.zip");
        assert_eq!(entries[0].kind, RemoteEntryKind::File);
        assert_eq!(entries[0].size, 7);
        assert_eq!(entries[1].path, "/builds/linux");
        assert_eq!(entries[1].kind, RemoteEntryKind::Directory);
        assert_eq!(entries[2].path, "/builds/notes.txt");
    }

    #[test]
    fn signing_key_matches_aws_example_vector() {
        // From AWS SigV4 documentation example values.
        let key = derive_signing_key(
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "20150830",
            "us-east-1",
            "iam",
        );
        assert_eq!(
            to_hex(&key),
            "2c94c0cf5378ada6887f09bb697df8fc0affdb34ba1cdd5bda32b664bd55b73c"
        );
    }

    #[test]
    fn connect_requires_access_key_credentials() {
        let profile = sample_profile();
        let error = S3NetworkProvider::connect(&profile, &RemoteCredential::bearer_token("token"))
            .unwrap_err();
        assert!(matches!(error, RemoteProviderError::Backend(_)));
    }

    #[test]
    fn formats_amz_timestamps() {
        assert_eq!(format_amz_date(1_440_938_160), "20150830T123600Z");
    }
}
