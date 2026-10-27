/**
 * InstructionsViewer — renders INSTRUCTIONS.md inside a scrollable ApplicationV2 window.
 */

const MODULE = "jack-small-details";

export class InstructionsViewer extends foundry.applications.api.ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "jsd-instructions",
    window: {
      title: "Jack Small Details — Instructions",
      resizable: true,
    },
    position: { width: 700, height: 720 },
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  async _renderHTML() {
    let markdown = "";
    try {
      const res = await fetch(`modules/${MODULE}/INSTRUCTIONS.md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      markdown = await res.text();
    } catch (err) {
      markdown = `# Error\n\nCould not load INSTRUCTIONS.md.\n\n\`${err.message}\``;
    }

    const container = document.createElement("div");
    container.id = "jsd-instructions-body";
    container.innerHTML = this.#markdownToHTML(markdown);
    return container;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  // ── Minimal Markdown → HTML ───────────────────────────────────────────────────

  #markdownToHTML(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      if (line.startsWith("```")) {
        const code = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          code.push(this.#esc(lines[i]));
          i++;
        }
        out.push(`<pre><code>${code.join("\n")}</code></pre>`);
        i++; // skip closing ```
        continue;
      }

      // Heading
      const hm = line.match(/^(#{1,3})\s+(.+)/);
      if (hm) {
        out.push(`<h${hm[1].length}>${this.#inline(hm[2])}</h${hm[1].length}>`);
        i++; continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line)) {
        out.push("<hr>");
        i++; continue;
      }

      // Table
      if (line.startsWith("|")) {
        const rows = [];
        while (i < lines.length && lines[i].startsWith("|")) {
          if (!/^\|[\s\-:|]+\|/.test(lines[i])) rows.push(lines[i]);
          i++;
        }
        if (rows.length) {
          const tbl = ["<table>"];
          rows.forEach((row, idx) => {
            const cells = row.split("|").slice(1, -1).map(c => c.trim());
            const tag = idx === 0 ? "th" : "td";
            tbl.push("<tr>" + cells.map(c => `<${tag}>${this.#inline(c)}</${tag}>`).join("") + "</tr>");
          });
          tbl.push("</table>");
          out.push(tbl.join(""));
        }
        continue;
      }

      // Unordered list
      if (line.startsWith("- ")) {
        const items = [];
        while (i < lines.length && lines[i].startsWith("- ")) {
          items.push(`<li>${this.#inline(lines[i].slice(2))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      // Numbered list
      if (/^\d+\.\s/.test(line)) {
        const items = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
          items.push(`<li>${this.#inline(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      // Empty line
      if (line.trim() === "") { i++; continue; }

      // Paragraph — collect contiguous plain lines
      const pLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("|") &&
        !lines[i].startsWith("- ") &&
        !/^\d+\.\s/.test(lines[i]) &&
        !lines[i].startsWith("```") &&
        !/^---+$/.test(lines[i])
      ) {
        pLines.push(lines[i]);
        i++;
      }
      if (pLines.length) out.push(`<p>${this.#inline(pLines.join(" "))}</p>`);
    }

    return out.join("\n");
  }

  /** Inline markdown: bold, italic, inline code. HTML-escaped. */
  #inline(text) {
    return this.#esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,     "<em>$1</em>")
      .replace(/`(.+?)`/g,       "<code>$1</code>");
  }

  #esc(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
