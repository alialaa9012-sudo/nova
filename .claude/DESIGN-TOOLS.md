# Design tools for Claude Code (installed 2026-11-14)

Project-scoped, so every Claude Code session on this repository has them.

| Tool | Version | Source | License | Where |
|---|---|---|---|---|
| Impeccable (skill, 4 agents, design hook) | 4.9.1, engine 0.1.24 | github.com/pbakaus/impeccable @ ae4cb4a | Apache-2.0 | `.claude/skills/impeccable`, `.claude/agents/impeccable-*`, hooks in `.claude/settings.json` |
| UI UX Pro Max (+ design, design-system, ui-styling, brand, banner-design, slides) | ui-ux-pro-max-cli 2.15.0 | github.com/nextlevelbuilder/ui-ux-pro-max-skill @ d643997 | MIT | `.claude/skills/<name>` |
| Anthropic frontend-design | skills repo @ 1780c5e | github.com/anthropics/skills | Apache-2.0 | `.claude/skills/frontend-design` |
| Playwright MCP | @playwright/mcp 0.0.85 | github.com/microsoft/playwright-mcp | Apache-2.0 | `.mcp.json` (server `playwright`) |
| 21st MCP (formerly Magic) | — | github.com/21st-dev/magic-mcp | ISC | not installed: needs a 21st.dev API key and network access to 21st.dev |

## Notes
- **Impeccable** was installed with its documented manual method (copy of the prebuilt `.claude/` build from the repository), because `npx impeccable install` downloads its bundle from impeccable.style, which this environment's network blocks. The engine binary is not committed: the launcher downloads it from the project's GitHub releases on first use and verifies it against `scripts/engine-checksums.txt`. Telemetry is turned off with `impeccable telemetry off` (per machine).
- **Impeccable hook:** after every Edit/Write of a UI file it runs the deterministic design detector and returns findings to the agent; a deeper pass runs when the agent stops.
- **UI UX Pro Max** search runs offline (Python standard library):
  `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system`.
  Its font suggestions are Latin-only; this app is Arabic RTL and keeps Cairo.
- **Playwright MCP** uses the browser preinstalled in the cloud image (`/opt/pw-browsers/chromium`), headless and isolated. Outside that image, remove `--executable-path` and its value from `.mcp.json`.
- New MCP servers load when a Claude Code session starts.
