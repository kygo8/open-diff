# Remote protocol smoke test

Unit tests cover URI parsing, profile persistence (passwords stay out of `remote-profiles.json`), and a real TCP/TLS connect failure against `127.0.0.1:1`. They do not start a live SFTP, FTP, Dropbox, or OneDrive service.

To smoke-test a live server or cloud drive:

1. Run the app or CLI with a writable config dir, for example `OPEN_DIFF_CONFIG_DIR=$PWD/.open-diff-config`.
2. Open **Settings → Remote Profiles**.
3. Create a profile:
   - **SFTP / FTP / FTPS / WebDAV**: host, port, username, password.
   - **S3**: bucket as root path, access key id, secret access key, optional region / path-style.
   - **SVN**: repository host/URL, optional username/password (empty password for anonymous).
   - **Dropbox / OneDrive**: paste an OAuth **access token** into the token field (host may be `dropbox` / `onedrive`). Browser OAuth is not bundled; obtain a token from your app console or a device-code flow.
4. Click **Save**, then **Test**. A success message must come from a real handshake plus a directory listing, not a queued/mock status.
5. Click **Browse remote** on the saved profile to list directories and pick a root path (credentials are not shown in the listing UI).
6. In Folder Compare, choose the profile or paste `sftp://profile/{id}/{remote-path}`, `dropbox://profile/{id}/{path}`, `onedrive://profile/{id}/{path}`, and so on. With a profile selected, **Browse** opens the remote folder picker. Text Compare can load the same URI with **Load Files**; **Browse** on a remote URI path also lists remotely.
7. Confirm `remote-profiles.json` has no password, and `remote-secrets.json` is mode `0600` on Unix.

Passwords and access tokens are never logged. There is no OS keyring in this build; secrets live only in that local file.
