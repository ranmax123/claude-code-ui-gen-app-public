# Download-as-ZIP Button — Design

## Purpose

Let the user export the current project's generated files (the in-browser virtual
file system) as a `.zip` they can download, without needing a server round-trip.

## Placement

`src/app/main-content.tsx`, in the "Top Bar" row of the right panel — between the
`Preview`/`Code` `Tabs` and `HeaderActions`. This is the empty gap in the header
shown in the reference screenshot. It renders regardless of which tab
(`preview`/`code`) is active and regardless of sign-in state, since it doesn't
depend on `user`.

## Scope

- Exports exactly what's in the virtual file system as-is (e.g. `App.jsx`,
  `components/*.jsx`, etc.) — no added scaffolding like `package.json`,
  `index.html`, or a build config. YAGNI: the user can add that separately if they
  ever need a standalone runnable project.
- Client-side only. No new API route, no server involvement — the virtual file
  system already only exists in the browser per the existing architecture.

## Components

### `src/lib/download-zip.ts`

```ts
export async function downloadFilesAsZip(
  files: Map<string, string>,
  projectName?: string
): Promise<void>
```

- Uses `jszip` (new dependency) to build a zip in memory. `JSZip#file(path, content)`
  accepts full nested paths (e.g. `"components/Button.jsx"`) and creates the
  intermediate folders automatically, so entries are added directly from the
  `Map<path, content>` returned by `getAllFiles()` — paths are stripped of any
  leading `/` since `VirtualFileSystem` paths are absolute.
- Filename: slugify `projectName` (lowercase, non-alphanumeric → `-`) and append
  `.zip`. Falls back to `uigen-export.zip` if `projectName` is missing/empty.
- Triggers the download via `Blob` + a temporary `<a download>` element
  (`URL.createObjectURL` / `revokeObjectURL`) — no extra `file-saver` dependency.
- Throws on failure; caller is responsible for catching.

### `src/components/DownloadZipButton.tsx`

- Client component (`"use client"`).
- Reads `getAllFiles` from `useFileSystem()` (`src/lib/contexts/file-system-context.tsx`).
- Accepts `projectName?: string` as a prop (passed down from `MainContent`, which
  already has `project?.name`).
- Renders a `Button` (`variant="outline"`, `className="h-8 gap-2"` — matching the
  sizing of buttons in `HeaderActions`) with a `Download` icon (`lucide-react`) and
  the label "Download ZIP".
- `disabled` when `getAllFiles().size === 0`.
- `onClick`: calls `downloadFilesAsZip(getAllFiles(), projectName)` inside a
  try/catch. On failure, `console.error` the error; the button is not left in a
  stuck/disabled state (no in-flight spinner needed — zip generation for
  small in-memory projects is effectively instant). No toast is introduced since
  the codebase has no existing toast/notification library; this can be revisited
  later if desired, but is out of scope here.

## Integration

`src/app/main-content.tsx`:

```tsx
<div className="h-14 border-b ... flex items-center justify-between ...">
  <Tabs ...>...</Tabs>
  <div className="flex items-center gap-2">
    <DownloadZipButton projectName={project?.name} />
    <HeaderActions user={user} projectId={project?.id} />
  </div>
</div>
```

## Testing

Co-located with the changed files per existing convention:

- `src/lib/__tests__/download-zip.test.ts` — verifies zip contents match the
  input `Map` (using `jszip`'s own loader to read back the generated blob),
  filename slugification (including the no-name fallback), and leading-slash
  stripping.
- `src/components/__tests__/DownloadZipButton.test.tsx` — verifies disabled state
  when the file system is empty, enabled when it has files, and that clicking
  invokes the download utility with the expected arguments (mocking
  `download-zip.ts`).

## Out of scope

- Runnable-project scaffolding (`package.json`, build config, etc.) in the zip.
- Toast/notification UI for success/failure.
- Server-side zip generation or persistence of the exported zip.
