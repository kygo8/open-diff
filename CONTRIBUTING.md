# Contributing to Open Diff

Thanks for taking the time to improve Open Diff. This project welcomes bug reports,
feature ideas, documentation fixes, and code contributions.

## Development Setup

Requirements:

- Node.js LTS
- pnpm via Corepack
- Rust stable toolchain
- Platform dependencies required by Tauri

Install dependencies:

```bash
corepack enable
corepack pnpm install
```

Run the web development server:

```bash
corepack pnpm dev
```

Run the Tauri app in development mode:

```bash
corepack pnpm tauri:dev
```

## Quality Checks

Before opening a pull request, run:

```bash
corepack pnpm quality
corepack pnpm test
```

Useful focused commands:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm stylelint
corepack pnpm typecheck
corepack pnpm rust:fmt:check
corepack pnpm rust:clippy
```

To apply formatting and lint fixes:

```bash
corepack pnpm quality:fix
```

## Pull Request Guidelines

- Keep pull requests focused on one bug, feature, or documentation topic.
- Add or update tests when changing behavior.
- Update documentation when user-facing behavior changes.
- Include screenshots or short recordings for visible UI changes.
- Link related issues when possible.

## Commit Messages

Use clear, concise commit messages. Chinese commit messages are welcome in this
repository.

Examples:

```text
修复文本比较行号错位
新增保存会话导出测试
完善发布工作流配置
```

## Reporting Bugs

Please use the bug report issue template and include:

- Operating system and version
- Open Diff version
- Installation source
- Comparison mode involved
- Reproduction steps
- Expected and actual behavior

## Proposing Features

Please use the feature request issue template. Describe the workflow you want to
improve and why it matters before proposing a specific implementation.
