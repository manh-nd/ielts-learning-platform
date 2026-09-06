# Project Webfonts

This directory contains committed, framework-independent `.woff2` font assets used across Next.js, Storybook, and Playwright Docker visual regression testing.

## Assets & Upstream Provenance

### 1. Inter Variable (Upright)

- **File**: `InterVariable.woff2`
- **Family**: `Chilly Inter`
- **Weights**: 100–900 (Variable)
- **Style**: Normal
- **Upstream Source**: [rsms/inter v4.1](https://github.com/rsms/inter/releases/tag/v4.1) (`web/InterVariable.woff2`)
- **License**: SIL Open Font License 1.1 ([LICENSE-Inter.txt](./LICENSE-Inter.txt))
- **SHA256**: `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`
- **Size**: 352,240 bytes
- **Coverage**: 2,853 glyphs. Complete Latin, Latin Extended-A/B, and Latin Extended Additional (full Vietnamese `U+1EA0..U+1EF9` coverage with zero missing characters).

### 2. Inter Variable (Italic)

- **File**: `InterVariable-Italic.woff2`
- **Family**: `Chilly Inter`
- **Weights**: 100–900 (Variable)
- **Style**: Italic
- **Upstream Source**: [rsms/inter v4.1](https://github.com/rsms/inter/releases/tag/v4.1) (`web/InterVariable-Italic.woff2`)
- **License**: SIL Open Font License 1.1 ([LICENSE-Inter.txt](./LICENSE-Inter.txt))
- **SHA256**: `e564f652916db6c139570fefb9524a77c4d48f30c92928de9db19b6b5c7a262a`
- **Size**: 387,976 bytes
- **Coverage**: Full Latin, Latin Extended, and Vietnamese italic coverage.

### 3. Geist Mono Variable

- **File**: `GeistMono-Variable.woff2`
- **Family**: `Chilly Geist Mono`
- **Weights**: 100–900 (Variable)
- **Style**: Normal
- **Upstream Source**: `geist@1.7.2` npm package (`dist/fonts/geist-mono/GeistMono-Variable.woff2`)
- **License**: SIL Open Font License 1.1 ([LICENSE-Geist.txt](./LICENSE-Geist.txt))
- **SHA256**: `fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab`
- **Size**: 71,368 bytes
- **Coverage**: 890 glyphs covering ASCII, numeric, programming ligatures, and technical symbols.

## Font Loading Invariant

The webfonts are declared in `app/fonts.css` using explicit family names (`"Chilly Inter"`, `"Chilly Geist Mono"`) without `local()` fallbacks. This guarantees that rendering uses the exact committed `.woff2` font bytes regardless of host operating system or installed system fonts.
