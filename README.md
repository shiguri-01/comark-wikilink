# comark-wikilink

Wikilink syntax plugin for [Comark](https://comark.dev).

This plugin adds support for `[[target]]` and `[[target|label]]` wikilink syntax to Markdown.

It supports two rendering modes:

- `a` mode (Default) —
  Parses wikilinks into standard link (`a`) nodes,
  producing the same AST output as standard markdown link syntax `[label](target)`.
- `component` mode —
  Parses wikilinks into custom `wikilink` nodes,
  allowing you to control how links are resolved and rendered via a custom component.

## Installation

```bash
npm install comark-wikilink comark
```

## `a` mode

```ts
wikilink({ mode: "a" });
```

Wikilinks are parsed into the same `a` nodes as regular Markdown links.
They can be rendered and customized through the same pipeline as other links, without any wikilink-specific handling.

### Configuration

```ts
{
  mode: "a";
  resolveHref?: (target: string) => string | null;
  resolveLabel?: (target: string) => string | null;
}
```

| Option         | Default | Description                                                                                                                            |
| :------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveHref`  | `null`  | A function that transforms a wikilink target into the `href` used by the generated `<a>` element. If `null`, the target is used as-is. |
| `resolveLabel` | `null`  | A function that resolves the label displayed for wikilinks that do not specify an explicit label. If `null`, the target is used as-is. |

## `component` mode

```ts
wikilink({ mode: "component" });
```

In `component` mode, wikilinks are parsed into custom wikilink nodes, allowing them to be handled separately from regular links.
Unlike `a` mode, `component` mode preserves whether a label was explicitly specified.

Use `mode: "component"` when wikilinks need to be handled differently from regular links.

### AST Output

For example:

```md
[[getting-started]]
[[getting-started|Getting started]]
```

The resulting AST nodes are:

```json
["wikilink", { "target": "getting-started" }]
["wikilink", { "target": "getting-started", "label": "Getting started" }]
```

The wikilink node has no children, so a wikilink component must be provided by the renderer.

### Example

```tsx
import { Markdown } from "@comark/react";
import wikilink from "comark-wikilink";

interface WikiLinkProps {
  target: string;
  label?: string;
}

function WikiLink({ target, label }: WikiLinkProps) {
  const page = getPage(target);

  if (!page) {
    return <span>{label ?? target}</span>;
  }

  return <a href={`/wiki/${page.slug}`}>{label ?? page.title}</a>;
}

export default function App() {
  return (
    <Markdown plugins={[wikilink({ mode: "component" })]} components={{ wikilink: WikiLink }}>
      {content}
    </Markdown>
  );
}
```

### Configuration

```ts
{
  mode: "component";
}
```

## License

MIT
