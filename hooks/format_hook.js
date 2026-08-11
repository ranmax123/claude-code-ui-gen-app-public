const fs = require("fs");
const path = require("path");

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const toolArgs = JSON.parse(Buffer.concat(chunks).toString());

  // filePath is the file Claude just wrote/edited. PostToolUse Write gives
  // tool_response.filePath; Edit gives tool_input.file_path.
  const filePath =
    toolArgs.tool_response?.filePath || toolArgs.tool_input?.file_path || "";

  if (!filePath) return;

  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) return;

  let prettier;
  try {
    prettier = require(path.join(__dirname, "..", "node_modules", "prettier"));
  } catch {
    return; // prettier not installed; nothing to do
  }

  try {
    const fileInfo = await prettier.getFileInfo(absPath, {
      ignorePath: [".gitignore", ".prettierignore"].filter((f) =>
        fs.existsSync(path.join(__dirname, "..", f))
      ),
    });
    if (fileInfo.ignored || !fileInfo.inferredParser) return;

    const source = fs.readFileSync(absPath, "utf8");
    const config = (await prettier.resolveConfig(absPath)) || {};
    const formatted = await prettier.format(source, {
      ...config,
      filepath: absPath,
    });

    if (formatted !== source) {
      fs.writeFileSync(absPath, formatted);
    }
  } catch (err) {
    // Don't fail the tool call just because formatting failed (unsupported
    // file type, syntax error mid-edit, etc.)
    console.error(`prettier: ${err.message}`);
  }
}

main();
