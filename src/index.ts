import { defineComarkPlugin, type MarkdownItPlugin } from "comark";
import { type StateInline } from "markdown-exit";

const OPEN = 0x5b; // [
const WIKILINK_RE = /^\[\[((?:(?!\]\])[^\n[])*)\]\]/;

type Wikilink = { target: string; label: string | null };

function parseWikilinkBody(body: string): Wikilink | null {
  const pipeIndex = body.indexOf("|");
  const hasLabel = pipeIndex !== -1;

  const target = (hasLabel ? body.slice(0, pipeIndex) : body).trim();
  const label = hasLabel ? body.slice(pipeIndex + 1).trim() : null;

  if (!target) {
    return null;
  }
  // `[[target|]]`のように`|`はあるがlabelが空なら無効
  if (hasLabel && !label) {
    return null;
  }

  return { target, label };
}

/**
 * Configuration for the `a` mode.
 */
type AnchorConfig = {
  /**
   * Resolves the `href` attribute from the wikilink target.
   *
   * If `null`, the `target` is used as-is.
   *
   * @default null
   */
  resolveHref?: ((target: string) => string) | null;

  /**
   * Resolves the label displayed for the wikilink.
   *
   * This is only used when the wikilink does not specify an explicit label.
   * If `null`, the target is used as the label.
   *
   * @default null
   */
  resolveLabel?: ((target: string) => string) | null;
};

/**
 * Options for the wikilink plugin.
 *
 * Use `mode: "a"` to render wikilinks as regular `<a>` elements.
 *
 * Use `mode: "component"` to convert wikilinks into a `wikilink` node that can be rendered with a custom component.
 */
export type WikilinkConfig = ({ mode: "a" } & AnchorConfig) | { mode: "component" };

function pushAnchorToken(
  state: StateInline,
  { href, content }: { href: string; content: string },
): void {
  const openToken = state.push("link_open", "a", 1);
  openToken.attrSet("href", href);
  openToken.markup = "[[";

  const textToken = state.push("text", "", 0);
  textToken.content = content;

  state.push("link_close", "a", -1);
}

function pushComponentToken(state: StateInline, { target, label }: Wikilink): void {
  const openToken = state.push("mdc_inline_component", "wikilink", 1);
  openToken.markup = "[[";

  state.push("mdc_inline_component", "wikilink", -1);

  // close直後にmdc_inline_propsを置くと、
  // Comark側がコンポーネントのattrsとして扱ってくれる
  const propsToken = state.push("mdc_inline_props", "", 0);
  propsToken.hidden = true;
  propsToken.attrSet("target", target);
  if (label !== null) {
    propsToken.attrSet("label", label);
  }
}

const createWikilinkRule =
  (config: WikilinkConfig) =>
  (state: StateInline, silent: boolean): boolean => {
    // [[から始まるか
    const start = state.pos;
    if (state.src.charCodeAt(start) !== OPEN) return false;
    if (state.src.charCodeAt(start + 1) !== OPEN) return false;

    const rest = state.src.slice(state.pos);
    const match = WIKILINK_RE.exec(rest);
    if (!match) {
      return false;
    }

    const parsed = parseWikilinkBody(match[1]);
    if (!parsed) {
      return false;
    }

    const { target, label } = parsed;

    if (config.mode === "a") {
      const rawHref = config.resolveHref ? config.resolveHref(target) : target;
      const href = state.md.normalizeLink(rawHref);
      if (!state.md.validateLink(href)) return false;

      const content = label ?? (config.resolveLabel ? config.resolveLabel(target) : target);

      if (!silent) {
        pushAnchorToken(state, { href, content });
      }
    } else if (config.mode === "component") {
      if (!silent) {
        pushComponentToken(state, { target, label });
      }
    }

    state.pos += match[0].length;
    return true;
  };

/**
 * Wikilinks plugin for Comark.
 *
 * This plugin adds support fot the `[[target]]` and `[[target|label]]` wikilink syntax to Markdown.
 *
 * This plugin allows you to use the `[[target]]` or `[[target|label]]` syntax in your Markdown to create links.
 *
 * In `a` mode, wikilinks are converted directly into regular `a` node.
 *
 * In `component` mode, wikilinks are converted into a `wikilink` node:
 *
 * ```ts
 * ["wikilink", { target: string, label?: string }]
 * ```
 *
 * This allows applications to resolve the target dynamically and render
 * wikilinks using their own components.
 *
 * @example
 * using `a` mode:
 * ```ts
 * import { parseMarkdown } from "comark";
 * import wikilink from "comark-wikilink";
 *
 * const tree = await parseMarkdown("[[target|label]]", {
 *  plugins: [wikilink({ mode: "a" })],
 *  });
 *  ```
 *
 * @example
 * using `component` mode with React:
 *
 * ```tsx
 * import { parseMarkdown } from "comark";
 * import wikilink from "comark-wikilink";
 *
 * interface WikiLinkProps {
 *   target: string;
 *   label?: string;
 * }
 *
 * function WikiLink({ target, label } : WikiLinkProps) {
 *   const page = getPage(target);
 *   const resolvedLabel = label ?? page.title;
 *   const href = `/wiki/${page.slug}`;
 *
 *   return <a href={href}>{resolvedLabel}</a>;
 * }
 *
 * export default function App() {
 *   return(
 *     <Markdown
 *       plugins={[wikilink({ mode: "component" })]}
 *       components={{ wikilink: WikiLink }}
 *     >
 *       {content}
 *     </Markdown>
 *   );
 * }
 *  ```
 */
export default defineComarkPlugin<WikilinkConfig>((config = { mode: "a" }) => {
  const plugin: MarkdownItPlugin = (md) => {
    md.inline.ruler.before("link", "wikilink", createWikilinkRule(config));
  };

  return {
    name: "wikilink",
    markdownItPlugins: [plugin],
  };
});
