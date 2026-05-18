async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const toolArgs = JSON.parse(Buffer.concat(chunks).toString());

  // readPath is the path to the file that Claude is trying to read
  const readPath =
    toolArgs.tool_input?.file_path || toolArgs.tool_input?.path || "";

    console.log(`Claude is trying to read: ${readPath}`);
  // TODO: ensure Claude isn't trying to read the .env file
  if (readPath.includes(".env")) {
    console.error("Claude is trying to read the .env file! Blocking this.");
    process.exit(2);
  }

}

main();
