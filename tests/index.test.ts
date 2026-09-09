import { parseMarkdown } from "comark";
import { describe, expect, it } from "vite-plus/test";

import wikilink, { type WikilinkConfig } from "../src/index";

async function parseWithWikilinkComponent(
  source: string,
  config: Omit<Extract<WikilinkConfig, { mode: "component" }>, "mode"> = {},
) {
  const tree = await parseMarkdown(source, {
    plugins: [wikilink({ mode: "component", ...config })],
    autoClose: false,
  });
  return tree.nodes;
}

async function parseWithWikilinkA(
  source: string,
  config: Omit<Extract<WikilinkConfig, { mode: "a" }>, "mode"> = {},
) {
  const tree = await parseMarkdown(source, {
    plugins: [wikilink({ mode: "a", ...config })],
    autoClose: false,
  });
  return tree.nodes;
}

async function parseWithoutWikilink(source: string) {
  const tree = await parseMarkdown(source, { autoClose: false });
  return tree.nodes;
}

describe("component mode", () => {
  it("parses [[target]] into a wikilink node without label", async () => {
    const nodes = await parseWithWikilinkComponent("[[target]]");
    expect(nodes).toEqual([["p", {}, ["wikilink", { target: "target" }]]]);
  });

  it("parses [[target|label]] into a wikilink node with label", async () => {
    const nodes = await parseWithWikilinkComponent("[[target|label]]");
    expect(nodes).toEqual([["p", {}, ["wikilink", { target: "target", label: "label" }]]]);
  });

  it("trims whitespace around target and label", async () => {
    const nodes = await parseWithWikilinkComponent("[[ target | label ]]");
    expect(nodes).toEqual([["p", {}, ["wikilink", { target: "target", label: "label" }]]]);
  });
});

describe("a mode", () => {
  it("renders [[target]] identically to standard link [target](target)", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[target]]");
    const normalNodes = await parseWithoutWikilink("[target](target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("renders [[target|label]] identically to standard link [label](target)", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[target|label]]");
    const normalNodes = await parseWithoutWikilink("[label](target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("trims whitespace around target and label before rendering link", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[ target | label ]]");
    const normalNodes = await parseWithoutWikilink("[label](target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("resolves href using resolveHref option", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[target]]", {
      resolveHref: (target) => `/wiki/${target}`,
    });
    const normalNodes = await parseWithoutWikilink("[target](/wiki/target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("resolves label using resolveLabel option when label is omitted", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[target]]", {
      resolveLabel: (target) => `Page: ${target}`,
    });
    const normalNodes = await parseWithoutWikilink("[Page: target](target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("prefers explicit label over resolveLabel option", async () => {
    const wikilinkNodes = await parseWithWikilinkA("[[target|label]]", {
      resolveLabel: (target) => `Page: ${target}`,
    });
    const normalNodes = await parseWithoutWikilink("[label](target)");
    expect(wikilinkNodes).toEqual(normalNodes);
  });

  it("ignores links rejected by validateLink such as javascript: URIs", async () => {
    const nodes = await parseWithWikilinkA("[[javascript:alert(1)]]");
    expect(JSON.stringify(nodes)).not.toContain("href");
  });
});

describe("syntax and edge cases", () => {
  it("ignores empty wikilinks like [[]] and [[ ]]", async () => {
    const nodes1 = await parseWithWikilinkComponent("[[]]");
    expect(JSON.stringify(nodes1)).not.toContain('"wikilink"');

    const nodes2 = await parseWithWikilinkComponent("[[ ]]");
    expect(JSON.stringify(nodes2)).not.toContain('"wikilink"');
  });

  it("ignores wikilinks with empty target like [[|label]]", async () => {
    const nodes = await parseWithWikilinkComponent("[[|label]]");
    expect(JSON.stringify(nodes)).not.toContain('"wikilink"');
  });

  it("ignores wikilinks with empty label like [[target|]]", async () => {
    const nodes = await parseWithWikilinkComponent("[[target|]]");
    expect(JSON.stringify(nodes)).not.toContain('"wikilink"');
  });

  it("ignores unclosed wikilinks like [[target]", async () => {
    const nodes = await parseWithWikilinkComponent("[[target]");
    expect(JSON.stringify(nodes)).not.toContain('"wikilink"');
  });

  it("ignores multiline wikilinks containing newlines", async () => {
    const nodes = await parseWithWikilinkComponent("[[target\n|label]]");
    expect(JSON.stringify(nodes)).not.toContain('"wikilink"');
  });

  it("supports Unicode characters, anchors, and labels", async () => {
    const markdown = "日本語ページ: [[設計仕様書#データ構造|第3章 データ構造]]";

    const aNodes = await parseWithWikilinkA(markdown, {
      resolveHref: (target) => `/docs/${encodeURIComponent(target)}`,
    });
    expect(JSON.stringify(aNodes)).toContain(
      `["a",{"href":"/docs/${encodeURIComponent("設計仕様書#データ構造")}"},"第3章 データ構造"]`,
    );

    const componentNodes = await parseWithWikilinkComponent(markdown);
    expect(JSON.stringify(componentNodes)).toContain(
      '["wikilink",{"target":"設計仕様書#データ構造","label":"第3章 データ構造"}]',
    );
  });

  it("parses multiple wikilinks in a single line in order", async () => {
    const md = "詳細は [[page-a|ページA]] と [[page-b]]、さらに [[page-c|ページC]] を参照。";
    const nodes = await parseWithWikilinkA(md);
    const jsonStr = JSON.stringify(nodes);

    expect(jsonStr).toContain('["a",{"href":"page-a"},"ページA"]');
    expect(jsonStr).toContain('["a",{"href":"page-b"},"page-b"]');
    expect(jsonStr).toContain('["a",{"href":"page-c"},"ページC"]');
  });

  it("parses wikilinks enclosed in punctuation or brackets", async () => {
    const md = "（[[note|備考]]）および【[[faq]]】";
    const nodes = await parseWithWikilinkA(md);
    const jsonStr = JSON.stringify(nodes);

    expect(jsonStr).toContain("（");
    expect(jsonStr).toContain('["a",{"href":"note"},"備考"]');
    expect(jsonStr).toContain("）および【");
    expect(jsonStr).toContain('["a",{"href":"faq"},"faq"]');
    expect(jsonStr).toContain("】");
  });

  it("falls back to plain text for unclosed links or extra brackets", async () => {
    const md = "通常の [[unclosed link テキスト と [[[extra-bracket]]] テキスト";
    const nodes = await parseWithWikilinkA(md);
    const jsonStr = JSON.stringify(nodes);

    expect(jsonStr).not.toContain('"href":"unclosed link"');
    expect(jsonStr).toContain('["a",{"href":"extra-bracket"},"extra-bracket"]');
  });
});
