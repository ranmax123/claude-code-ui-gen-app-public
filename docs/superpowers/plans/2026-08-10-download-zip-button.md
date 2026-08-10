# Download-as-ZIP Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download ZIP" button to the top bar of the right panel that exports the current virtual file system as a downloadable `.zip` file.

**Architecture:** A pure client-side utility (`downloadFilesAsZip`) builds a zip with `jszip` from the `Map<path, content>` returned by `useFileSystem().getAllFiles()` and triggers a browser download via a `Blob` + temporary `<a download>`. A new `DownloadZipButton` component wires that utility to a `Button` placed in `main-content.tsx`'s top bar, between the `Tabs` and `HeaderActions`.

**Tech Stack:** Next.js 15 / React, TypeScript, `jszip` (new dependency), Vitest + Testing Library (co-located `__tests__`), existing `Button` (shadcn/radix) and `lucide-react` icons.

## Global Constraints

- Client-side only — no new API route, no server involvement (spec: "Scope").
- Zip contains exactly the virtual file system's files as-is — no added scaffolding like `package.json`/`index.html`/build config (spec: "Scope").
- Filename: slugified `projectName` + `.zip`, falling back to `uigen-export.zip` when `projectName` is missing/empty (spec: "`download-zip.ts`").
- Paths passed to `jszip` must have any leading `/` stripped (spec: "`download-zip.ts`").
- Button is `variant="outline"`, `className="h-8 gap-2"`, `Download` icon (lucide-react) + "Download ZIP" label, `disabled` when `getAllFiles().size === 0` (spec: "`DownloadZipButton.tsx`").
- Errors from zip generation/download are caught in the component and `console.error`'d — no toast/notification library exists in this codebase and none is to be introduced (spec: "`DownloadZipButton.tsx`", "Out of scope").
- Tests are co-located: `src/lib/__tests__/download-zip.test.ts`, `src/components/__tests__/DownloadZipButton.test.tsx` (spec: "Testing").

---

### Task 1: `downloadFilesAsZip` utility

**Files:**
- Create: `src/lib/download-zip.ts`
- Test: `src/lib/__tests__/download-zip.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (only the `jszip` package, added as a dependency in this task).
- Produces: `downloadFilesAsZip(files: Map<string, string>, projectName?: string): Promise<void>` — used by Task 2's `DownloadZipButton`.

This task builds the zip `Blob` and triggers the download. To keep it testable under jsdom (no real navigation), the DOM-triggering part is isolated behind `URL.createObjectURL`/`URL.revokeObjectURL` and a temporary anchor click, all of which jsdom + Vitest support mocking.

- [ ] **Step 1: Add the `jszip` dependency**

Run: `npm install jszip`

Verify `jszip` now appears under `"dependencies"` in `package.json`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/__tests__/download-zip.test.ts`:

```ts
import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import JSZip from "jszip";
import { downloadFilesAsZip } from "@/lib/download-zip";

describe("downloadFilesAsZip", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendedAnchor: HTMLAnchorElement | null;

  beforeEach(() => {
    appendedAnchor = null;
    createObjectURLSpy = vi.fn(() => "blob:mock-url");
    revokeObjectURLSpy = vi.fn();
    // jsdom doesn't implement these; stub them for every test in this file.
    URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;

    clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        appendedAnchor = el as HTMLAnchorElement;
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("builds a zip containing every file, stripping leading slashes", async () => {
    const files = new Map<string, string>([
      ["/App.jsx", "export default function App() {}"],
      ["/components/Button.jsx", "export default function Button() {}"],
    ]);

    await downloadFilesAsZip(files, "My Project");

    // Re-read the blob passed to createObjectURL to assert on zip contents.
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    expect(Object.keys(zip.files).sort()).toEqual(
      ["App.jsx", "components/Button.jsx"].sort()
    );
    expect(await zip.file("App.jsx")!.async("string")).toBe(
      "export default function App() {}"
    );
    expect(
      await zip.file("components/Button.jsx")!.async("string")
    ).toBe("export default function Button() {}");
  });

  test("slugifies the project name into the download filename", async () => {
    const files = new Map<string, string>([["/App.jsx", "content"]]);

    await downloadFilesAsZip(files, "My Cool Project!");

    expect(appendedAnchor?.download).toBe("my-cool-project.zip");
  });

  test("falls back to a generic filename when projectName is missing", async () => {
    const files = new Map<string, string>([["/App.jsx", "content"]]);

    await downloadFilesAsZip(files, undefined);

    expect(appendedAnchor?.download).toBe("uigen-export.zip");
  });

  test("falls back to a generic filename when projectName is empty", async () => {
    const files = new Map<string, string>([["/App.jsx", "content"]]);

    await downloadFilesAsZip(files, "   ");

    expect(appendedAnchor?.download).toBe("uigen-export.zip");
  });

  test("triggers the download by clicking a temporary anchor and revokes the URL", async () => {
    const files = new Map<string, string>([["/App.jsx", "content"]]);

    await downloadFilesAsZip(files, "Proj");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- --run src/lib/__tests__/download-zip.test.ts`
Expected: FAIL — `Cannot find module '@/lib/download-zip'` (or similar), since the file doesn't exist yet.

- [ ] **Step 4: Implement `downloadFilesAsZip`**

Create `src/lib/download-zip.ts`:

```ts
import JSZip from "jszip";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFilename(projectName?: string): string {
  const slug = projectName ? slugify(projectName) : "";
  return slug ? `${slug}.zip` : "uigen-export.zip";
}

export async function downloadFilesAsZip(
  files: Map<string, string>,
  projectName?: string
): Promise<void> {
  const zip = new JSZip();

  for (const [path, content] of files) {
    const relativePath = path.startsWith("/") ? path.slice(1) : path;
    zip.file(relativePath, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = buildFilename(projectName);

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- --run src/lib/__tests__/download-zip.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/download-zip.ts src/lib/__tests__/download-zip.test.ts
git commit -m "feat: add downloadFilesAsZip utility

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `DownloadZipButton` component

**Files:**
- Create: `src/components/DownloadZipButton.tsx`
- Test: `src/components/__tests__/DownloadZipButton.test.tsx`

**Interfaces:**
- Consumes: `downloadFilesAsZip(files: Map<string, string>, projectName?: string): Promise<void>` from Task 1 (`@/lib/download-zip`); `useFileSystem()` from `@/lib/contexts/file-system-context` (existing — returns `{ getAllFiles: () => Map<string, string>, refreshTrigger: number, ... }`); `Button` from `@/components/ui/button` (existing).
- Produces: `DownloadZipButton({ projectName }: { projectName?: string })` — used by Task 3 in `main-content.tsx`.

The button must re-evaluate `getAllFiles().size` whenever files change, which is signaled by `refreshTrigger` changing (see `FileSystemProvider` — every mutation calls `triggerRefresh`). Since `getAllFiles` is a function, not reactive state, recompute the file count from `refreshTrigger` via `useMemo`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/DownloadZipButton.test.tsx`:

```tsx
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DownloadZipButton } from "@/components/DownloadZipButton";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { downloadFilesAsZip } from "@/lib/download-zip";

vi.mock("@/lib/contexts/file-system-context");
vi.mock("@/lib/download-zip");

vi.mock("lucide-react", () => ({
  Download: ({ className }: { className?: string }) => (
    <div className={className}>Download</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockFileSystem(files: Map<string, string>) {
  const mockUseFileSystem = useFileSystem as ReturnType<typeof vi.fn>;
  mockUseFileSystem.mockReturnValue({
    getAllFiles: () => files,
    refreshTrigger: 0,
  });
}

test("is disabled when the file system is empty", () => {
  mockFileSystem(new Map());

  render(<DownloadZipButton projectName="Proj" />);

  expect(screen.getByRole("button", { name: /download zip/i })).toBeDisabled();
});

test("is enabled when the file system has files", () => {
  mockFileSystem(new Map([["/App.jsx", "content"]]));

  render(<DownloadZipButton projectName="Proj" />);

  expect(screen.getByRole("button", { name: /download zip/i })).toBeEnabled();
});

test("clicking calls downloadFilesAsZip with the files and project name", () => {
  const files = new Map([["/App.jsx", "content"]]);
  mockFileSystem(files);
  const mockDownload = downloadFilesAsZip as ReturnType<typeof vi.fn>;
  mockDownload.mockResolvedValue(undefined);

  render(<DownloadZipButton projectName="Proj" />);
  fireEvent.click(screen.getByRole("button", { name: /download zip/i }));

  expect(mockDownload).toHaveBeenCalledWith(files, "Proj");
});

test("logs an error and keeps the button enabled if the download fails", async () => {
  mockFileSystem(new Map([["/App.jsx", "content"]]));
  const mockDownload = downloadFilesAsZip as ReturnType<typeof vi.fn>;
  mockDownload.mockRejectedValue(new Error("zip failed"));
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  render(<DownloadZipButton projectName="Proj" />);
  const button = screen.getByRole("button", { name: /download zip/i });
  fireEvent.click(button);

  await vi.waitFor(() => expect(consoleSpy).toHaveBeenCalled());
  expect(button).toBeEnabled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --run src/components/__tests__/DownloadZipButton.test.tsx`
Expected: FAIL — `Cannot find module '@/components/DownloadZipButton'`

- [ ] **Step 3: Implement `DownloadZipButton`**

Create `src/components/DownloadZipButton.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileSystem } from "@/lib/contexts/file-system-context";
import { downloadFilesAsZip } from "@/lib/download-zip";

interface DownloadZipButtonProps {
  projectName?: string;
}

export function DownloadZipButton({ projectName }: DownloadZipButtonProps) {
  const { getAllFiles, refreshTrigger } = useFileSystem();

  // refreshTrigger changes on every file-system mutation (see
  // FileSystemProvider.triggerRefresh); recompute the file count then,
  // since getAllFiles() itself isn't reactive state.
  const hasFiles = useMemo(() => {
    return getAllFiles().size > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllFiles, refreshTrigger]);

  const handleClick = async () => {
    try {
      await downloadFilesAsZip(getAllFiles(), projectName);
    } catch (error) {
      console.error("Failed to download project as zip:", error);
    }
  };

  return (
    <Button
      variant="outline"
      className="h-8 gap-2"
      disabled={!hasFiles}
      onClick={handleClick}
    >
      <Download className="h-4 w-4" />
      Download ZIP
    </Button>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run src/components/__tests__/DownloadZipButton.test.tsx`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/DownloadZipButton.tsx src/components/__tests__/DownloadZipButton.test.tsx
git commit -m "feat: add DownloadZipButton component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the button into the top bar

**Files:**
- Modify: `src/app/main-content.tsx:58-75` (the "Right Panel - Preview/Code" top bar block)

**Interfaces:**
- Consumes: `DownloadZipButton` from Task 2 (`@/components/DownloadZipButton`); existing `project?.name` already available in this file's props.
- Produces: nothing consumed by later tasks — this is the final integration point.

No new automated test here: `main-content.tsx` isn't currently under `__tests__` coverage, and this task is a layout wiring change with behavior already covered by Task 2's component tests. Verification is manual (Step 2 below), matching how other top-bar composition in this file is treated.

- [ ] **Step 1: Add the import and render the button**

In `src/app/main-content.tsx`, add the import alongside the other component imports:

```tsx
import { HeaderActions } from "@/components/HeaderActions";
import { DownloadZipButton } from "@/components/DownloadZipButton";
```

Then replace:

```tsx
                  <HeaderActions user={user} projectId={project?.id} />
```

with:

```tsx
                  <div className="flex items-center gap-2">
                    <DownloadZipButton projectName={project?.name} />
                    <HeaderActions user={user} projectId={project?.id} />
                  </div>
```

- [ ] **Step 2: Manually verify in the running app**

Run: `npm run dev`, open `http://localhost:3000`, and confirm:
- The "Download ZIP" button appears between the Preview/Code tabs and Sign In/Sign Up, in the gap from the reference screenshot.
- It's disabled when the project has no files yet (fresh anonymous session, before any generation).
- After the mock model generates `App.jsx` (see `CLAUDE.md`'s note on `MockLanguageModel`), the button becomes enabled.
- Clicking it downloads a `.zip`; unzip it and confirm the files match what's shown in the Code tab, with paths matching (e.g. `App.jsx`, not `/App.jsx` or `App.jsx/`).

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS — no regressions in any existing suite.

- [ ] **Step 4: Commit**

```bash
git add src/app/main-content.tsx
git commit -m "feat: wire DownloadZipButton into the top bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
