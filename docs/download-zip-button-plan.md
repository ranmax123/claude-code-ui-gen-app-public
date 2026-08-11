# Download-as-ZIP Button — Plan

## Goal
Add a "Download" button to the top bar of the Preview/Code panel, positioned
between the Preview/Code tabs and the account controls (Sign In/Sign Up, or
the project selector when signed in) — see the requested placement in the
UI screenshot provided by the user.

## Behavior
Clicking the button zips up all files currently in the in-memory
`VirtualFileSystem` (the generated component code) and downloads them as a
`.zip` file to the user's machine. This is entirely client-side — no server
round-trip is needed, since the file contents already live in the browser
via `FileSystemContext`.

## Implementation

1. **Dependency**: add `jszip` (small, well-known, works fine in-browser)
   to `package.json`.

2. **New component**: `src/components/DownloadButton.tsx`
   - Uses `useFileSystem()` (`src/lib/contexts/file-system-context.tsx`) to
     call `getAllFiles()`, which returns a `Map<string, string>` of virtual
     file paths to their contents.
   - Builds a zip in-memory with JSZip, preserving the virtual file
     paths/folder structure.
   - Triggers a browser download via a `Blob` + temporary `<a download>`
     link. Names the file after the project (e.g. `project-name.zip`), or
     `uigen-export.zip` if there's no project name yet.
   - Shows a download icon (`lucide-react`'s `Download`) with a brief
     loading/disabled state while zipping.

3. **Wiring**: in `src/app/main-content.tsx`, add `<DownloadButton />` in
   the top bar's flex container, placed just before `<HeaderActions ... />`
   so it sits in the gap shown in the screenshot.

4. **Edge cases**:
   - Disable (or no-op with a toast) when there are no files yet, so it's
     not clickable on a blank project.

## Out of scope
- No server-side changes.
- No new Prisma fields/persistence — this only reads the already-in-memory
  `VirtualFileSystem` on the client.
