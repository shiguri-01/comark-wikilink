import { parseMarkdown } from "comark";
import { describe, expect, it } from "vite-plus/test";

import wikilink from "../src/index";

describe("document parsing", () => {
  const sampleDocument = `
# プロジェクトドキュメント

このプロジェクトは [[introduction|はじめに]] からスタートしてください。
詳細な仕様は [[docs/specification]] に記載されています。

## 主な機能

* [[features/auth|認証機能]]: OAuth2 と セッション管理
* [[features/editor|エディタ機能]]: Markdown リアルタイムプレビュー
* [[features/plugins]]: プラグイン拡張機構

## 補足と注意

> 注意: 設定の変更を行う前に必ず [[configuration#backup|バックアップ手順]] を確認してください。

関連ページ一覧:
| カテゴリ | リンク |
| :--- | :--- |
| ガイド | [[guides/getting-started\\|入門ガイド]] |
| API | [[api/reference]] |

インラインコード内の \`[[not-a-link]]\` やコードブロック内の wikilink 記法はパースされません:

\`\`\`markdown
[[code-block-example]]
\`\`\`

**[[important|重要な注意事項]]** も太字の中で機能します。
`.trim();

  it("parses realistic document into anchor nodes in 'a' mode", async () => {
    const tree = await parseMarkdown(sampleDocument, {
      plugins: [
        wikilink({
          mode: "a",
          resolveHref: (target) => `/wiki/${encodeURI(target)}`,
        }),
      ],
    });

    const jsonStr = JSON.stringify(tree.nodes);

    // Preserves headings and regular text
    expect(jsonStr).toContain("プロジェクトドキュメント");

    // Converts wikilinks to anchor nodes
    expect(jsonStr).toContain('["a",{"href":"/wiki/introduction"},"はじめに"]');
    expect(jsonStr).toContain('["a",{"href":"/wiki/docs/specification"},"docs/specification"]');

    // Inside list items
    expect(jsonStr).toContain('["a",{"href":"/wiki/features/auth"},"認証機能"]');
    expect(jsonStr).toContain('["a",{"href":"/wiki/features/plugins"},"features/plugins"]');

    // Inside blockquote
    expect(jsonStr).toContain('["a",{"href":"/wiki/configuration#backup"},"バックアップ手順"]');

    // Inside table
    expect(jsonStr).toContain('["a",{"href":"/wiki/guides/getting-started"},"入門ガイド"]');
    expect(jsonStr).toContain('["a",{"href":"/wiki/api/reference"},"api/reference"]');

    // Inside bold text
    expect(jsonStr).toContain('["strong",{},["a",{"href":"/wiki/important"},"重要な注意事項"]]');

    // Preserves code spans and code blocks without converting
    expect(jsonStr).toContain('"[[not-a-link]]"');
    expect(jsonStr).toContain("[[code-block-example]]");
  });

  it("parses realistic document into wikilink nodes in 'component' mode", async () => {
    const tree = await parseMarkdown(sampleDocument, {
      plugins: [wikilink({ mode: "component" })],
    });

    const jsonStr = JSON.stringify(tree.nodes);

    // Converts wikilinks to component nodes
    expect(jsonStr).toContain('["wikilink",{"target":"introduction","label":"はじめに"}]');
    expect(jsonStr).toContain('["wikilink",{"target":"docs/specification"}]');
    expect(jsonStr).toContain('["wikilink",{"target":"features/auth","label":"認証機能"}]');
    expect(jsonStr).toContain(
      '["wikilink",{"target":"configuration#backup","label":"バックアップ手順"}]',
    );

    // Does not convert inside code spans or code blocks
    expect(jsonStr).not.toContain('{"target":"not-a-link"}');
    expect(jsonStr).not.toContain('{"target":"code-block-example"}');
  });
});
