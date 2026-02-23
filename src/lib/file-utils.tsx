import { FileText, File, FileSpreadsheet, FileImage } from 'lucide-react';

export function getFileIcon(mimeType?: string) {
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
  }
  if (mimeType?.includes('image')) {
    return <FileImage className="h-5 w-5 text-purple-500" />;
  }
  if (mimeType?.includes('pdf')) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
