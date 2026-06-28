# Open Diff

Open Diff is a cross-platform comparison and merge tool for files, folders, tables, images, and binary data. It is designed for developers, content editors, data analysts, and anyone who needs to inspect changes clearly before copying, merging, synchronizing, or reporting them.

## Translations

- [简体中文](docs/readme/README.zh-CN.md)
- [繁體中文](docs/readme/README.zh-TW.md)
- [한국어](docs/readme/README.ko.md)
- [Español](docs/readme/README.es.md)
- [Français](docs/readme/README.fr.md)
- [Deutsch](docs/readme/README.de.md)

## Installation

Download the latest installer or platform bundle from the
[GitHub Releases](https://github.com/kygo8/open-diff/releases) page.

Release assets are published for supported desktop platforms through the Tauri
release workflow.

## Development

Requirements:

- Node.js LTS
- pnpm through Corepack
- Rust stable toolchain
- Platform dependencies required by Tauri

Install dependencies:

```bash
corepack enable
corepack pnpm install
```

Run the web app during development:

```bash
corepack pnpm dev
```

Run the desktop app during development:

```bash
corepack pnpm tauri:dev
```

Build the frontend:

```bash
corepack pnpm build
```

Build desktop bundles:

```bash
corepack pnpm tauri:build
```

## Quality Checks

Run the full local quality gate before opening a pull request:

```bash
corepack pnpm quality
corepack pnpm test
```

The quality gate includes formatting checks, ESLint, Stylelint, TypeScript type
checking, Rust formatting checks, and Clippy.

## Contributing

Issues and pull requests are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before submitting code changes.

- Use the bug report template for reproducible problems.
- Use the feature request template for workflow and product suggestions.
- Report security vulnerabilities privately according to
  [SECURITY.md](SECURITY.md).

## Release Process

Open Diff uses semantic version tags such as `v1.0.0`.

When a `v*` tag is pushed, GitHub Actions builds Tauri bundles for Windows,
macOS, and Linux, creates a draft GitHub Release, uploads the generated desktop
assets, and generates release notes.

Before creating a release tag, make sure the version is synchronized across:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

## Core Features

### Text Comparison

Open Diff provides a focused side-by-side text comparison workflow.

- Compare two text files line by line.
- Highlight inserted, deleted, and modified lines.
- Highlight character-level changes inside modified lines.
- Support syntax highlighting for common programming and markup languages.
- Ignore whitespace-only changes when needed.
- Ignore case-only changes when needed.
- Ignore comments for source-code focused comparisons.
- Navigate to the next or previous difference.
- Search within compared content.
- Jump directly to a line number.
- Display line numbers for both sides.
- Support word wrap for long lines.
- Select file encoding when content is not UTF-8.

### Folder Comparison

Open Diff can compare two folders and show their differences in a structured tree/table view.

- Scan left and right folders recursively.
- Show files that are identical, modified, left-only, or right-only.
- Compare files by size, modified time, or content checksum.
- Filter the view to show all items, only differences, only identical files, left-only files, or right-only files.
- Exclude files by simple glob-like patterns.
- Open matching files from the folder comparison in text comparison mode.
- Copy left-only files to the right side.
- Copy right-only files to the left side.
- Refresh comparison results after file operations.
- Display file size and modified time for both sides.

### Folder Synchronization

Open Diff includes a synchronization workflow for applying folder changes safely.

- Preview synchronization actions before execution.
- Update the right folder from the left folder.
- Update the left folder from the right folder.
- Update both folders using newer or missing files.
- Mirror the right folder from the left folder.
- Mirror the left folder from the right folder.
- Show planned copy and delete actions.
- Track synchronization progress.
- Show operation logs after execution.

### Table Comparison

Open Diff supports comparing structured tabular data.

- Compare CSV files.
- Compare TSV files.
- Compare spreadsheet-style data.
- Detect added, deleted, modified, and equal rows.
- Highlight changed cells inside modified rows.
- Show a side-by-side table view.
- Show a unified text-like view for table differences.
- Toggle whether the first row should be treated as headers.
- Choose common delimiters such as comma, tab, and semicolon.

### Image Comparison

Open Diff supports pixel-oriented image comparison.

- Load two images side by side.
- Compare images at pixel level.
- Show the percentage of differing pixels.
- Detect image size mismatches.
- Optionally include alpha channel differences.
- Display image previews for manual inspection.

### Binary and Hex Comparison

Open Diff includes a hexadecimal comparison view for binary files.

- Load two binary files.
- Show byte offsets.
- Display hexadecimal byte values.
- Display ASCII representation beside byte values.
- Highlight changed bytes.
- Mark left-only and right-only byte ranges.
- Show basic difference statistics.

### Three-Way Merge

Open Diff is designed to support conflict-resolution workflows.

- Use a base version, a left version, and a right version.
- Detect conflicting changes.
- Present resolved and conflicting output sections.
- Help users build a final merged result.

### Session Management

Open Diff can save and restore comparison work.

- Save comparison sessions.
- List recent sessions.
- Reopen previous sessions.
- Delete old sessions.
- Import session data from JSON.
- Export session data to JSON.
- Store comparison configuration with each session.

### Reports

Open Diff is intended to generate shareable comparison summaries.

- Generate HTML comparison reports.
- Include file labels, statistics, and side-by-side differences.
- Provide print-friendly report styling.
- Use reports for review, audit, or handoff workflows.

### Automation

Open Diff is planned to support repeatable command-line and scripted workflows.

- Run comparisons from the command line.
- Generate machine-readable results.
- Execute scripted comparison tasks.
- Support repeatable folder comparison, synchronization, and report generation.
- Generate Git difftool, Git mergetool, and Subversion external diff setup commands.

## Planned Capabilities

The following areas are part of the product direction:

- Advanced text merge conflict editing.
- Folder merge workflows.
- Rich file format rules.
- More spreadsheet formats and sheet mapping.
- Image tolerance controls and visual diff overlays.
- Remote file access profiles.
- Archive comparison.
- Git difftool, Git mergetool, and Subversion external diff integration.
- Custom keyboard shortcuts.
- Additional report formats.

## Typical Use Cases

- Review source code changes before committing.
- Compare generated files or configuration snapshots.
- Synchronize project folders.
- Inspect deployment package differences.
- Compare exported CSV or spreadsheet data.
- Check whether two images are visually or pixel-wise different.
- Inspect binary file changes at byte level.
- Save recurring comparison sessions for repeated work.

## Project Status

Open Diff is at an early repository stage. The README describes the intended
feature set and product direction while the implementation continues to evolve.
Some listed capabilities may still be in progress.

## License

Open Diff is licensed under the [Apache License 2.0](LICENSE).
