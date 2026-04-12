# Figma MCP setup (Linux-compatible)

Figma's **official** Dev Mode MCP server requires the Figma desktop app, which exists only for macOS and Windows. On Linux, use the community package `figma-developer-mcp` (GLips), which talks to the Figma REST API directly with a personal access token.

## Prerequisites

1. A Figma account
2. A Figma Personal Access Token:
   - figma.com → click your avatar → Settings → Security → Personal access tokens
   - Create a token with **at least** `file_content:read` and `file_dev_resources:read` scopes
   - Copy it — you won't see it again

## Install

```bash
claude mcp add figma -- npx -y figma-developer-mcp --figma-api-key=YOUR_FIGMA_TOKEN --stdio
```

Replace `YOUR_FIGMA_TOKEN` with the token from step 1. This registers the MCP server under the name `figma` for stdio transport, auto-launched by Claude Code on first use.

## Verify

```bash
claude mcp list
```

You should see a line like:

```
figma: npx -y figma-developer-mcp --figma-api-key=... --stdio - ✓ Connected
```

If it shows `! Needs authentication` or an error, re-check the token scopes.

## Usage from Claude

Once connected, Claude gains tools prefixed `mcp__figma__*` (or similar — the exact names depend on the package version). Inside Claude Code, ask:

> Convert this Figma frame to a React component: https://figma.com/file/ABC123/Project?node-id=42-0

The `figma-to-jsx` skill will pick it up, call the MCP tools to fetch the node, and scaffold the component.

## Gotchas

- **Token in argv is visible to other processes on the machine.** Treat it as a secret — don't share screenshots of `claude mcp list` output, don't commit the token anywhere. Rotate it in Figma settings if leaked.
- **Private files** need the token's owner to have access. Shared design files from other accounts will 403 unless you're a collaborator.
- **Rate limits** apply to the Figma REST API. Fetching many large frames in a loop will throttle. Pull one node at a time.
