# Shared Test Fixtures

These fixtures are intentionally small, deterministic, and reusable across frontend, Rust, CLI, and
e2e tests. Keep fixture files stable unless a test explicitly needs a new scenario.

Categories:

- `text`: paired text documents for line and inline diff behavior.
- `table`: CSV data with stable keys and changed cells.
- `image`: small PNG files for pixel comparison.
- `binary`: byte payloads for hex and binary comparison.
- `folder`: left/right directory trees for folder compare and sync tests.

When adding a fixture, update `manifest.json` and include a short description of the behavior it is
meant to exercise.
