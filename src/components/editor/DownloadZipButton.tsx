"use client";

import { useState } from "react";
import JSZip from "jszip";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileSystem } from "@/lib/contexts/file-system-context";

export function DownloadZipButton() {
  const { getAllFiles } = useFileSystem();
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    const files = getAllFiles();
    if (files.size === 0) return;

    setIsLoading(true);
    try {
      const zip = new JSZip();

      for (const [path, content] of files) {
        // Strip leading slash for zip paths
        const zipPath = path.startsWith("/") ? path.slice(1) : path;
        zip.file(zipPath, content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "components.zip";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-2"
      onClick={handleDownload}
      disabled={isLoading}
      title="Download as ZIP"
    >
      <Download className="h-4 w-4" />
      {isLoading ? "Downloading..." : "Download ZIP"}
    </Button>
  );
}
