import type { ExportArtifact } from "../../types/import-export";

export function downloadArtifact(artifact: ExportArtifact): void {
  const blob = new Blob([artifact.content], { type: artifact.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = artifact.fileName;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}
