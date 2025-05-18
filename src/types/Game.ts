/**
 * Game information interface
 */
export interface Game {
  id: string;
  title: string;
  path: string;
  platform?: string;
  native: boolean;
  api_files: string[];
  cream_installed?: boolean;
  smoke_installed?: boolean;
  installing?: boolean;
}