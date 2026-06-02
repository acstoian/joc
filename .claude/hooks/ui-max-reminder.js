#!/usr/bin/env node
// PostToolUse hook: when a frontend file is edited/written, inject a reminder
// to consult the project's frontend skills. Reads hook JSON on stdin, emits
// hookSpecificOutput.additionalContext when the touched file is frontend.
// Local dev only — no network, no build side effects; just context injection.

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let fp = "";
  try {
    const data = JSON.parse(raw || "{}");
    fp = (data.tool_input && data.tool_input.file_path) || "";
  } catch {
    return; // malformed input → do nothing (exits 0 naturally)
  }

  const path = fp.replace(/\\/g, "/").toLowerCase();

  const isStyleOrComponent =
    path.includes("/src/components/") ||
    path.includes("/src/app/") ||
    /\.(tsx|jsx|css)$/.test(path);
  // React/Next source (perf guidance applies)
  const isReact = /\.(tsx|jsx)$/.test(path);

  if (!isStyleOrComponent) return;

  const skills = [
    "ui-ux-pro-max — review/improve the UI (styles, layout, typography, color, spacing, accessibility, interaction states)",
  ];
  if (isReact) {
    skills.push(
      "vercel-react-best-practices — check React/Next.js performance patterns (data fetching, server vs client components, bundle/render cost)"
    );
    skills.push(
      "shadcn — when adding or composing UI components, prefer/extend shadcn components and follow its conventions"
    );
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "Frontend file touched (" +
          fp +
          "). Per project preference, consult these skills before considering the change done:\n- " +
          skills.join("\n- "),
      },
    })
  );
  // Exit naturally so stdout flushes (no process.exit()).
});
