"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useFileSystem } from "@/lib/contexts/file-system-context";

interface DownloadButtonProps {
  projectName?: string;
}

export function DownloadButton({ projectName }: DownloadButtonProps) {
  const { getAllFiles } = useFileSystem();
  const [isDownloading, setIsDownloading] = useState(false);

  const files = getAllFiles();
  const hasFiles = files.size > 0;

  const handleDownload = async () => {
    if (!hasFiles || isDownloading) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      for (const [path, content] of files) {
        // Virtual paths are absolute (e.g. "/App.jsx"); strip the leading
        // slash so JSZip doesn't create an empty root segment.
        zip.file(path.replace(/^\//, ""), content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName || "uigen-export"}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="h-8 gap-2"
      onClick={handleDownload}
      disabled={!hasFiles || isDownloading}
      title={hasFiles ? "Download project as ZIP" : "No files to download yet"}
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Download
    </Button>
  );
}
