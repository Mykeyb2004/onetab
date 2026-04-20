export type PermissionMode = "read" | "readwrite";

export interface FileLike {
  text(): Promise<string>;
}

export interface WritableFileLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  getFile(): Promise<FileLike>;
  createWritable(): Promise<WritableFileLike>;
}

export interface DirectoryHandleLike {
  name: string;
  queryPermission(descriptor?: { mode?: PermissionMode }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode?: PermissionMode }): Promise<PermissionState>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry?(name: string): Promise<void>;
}

export interface DirectoryHandleStore<
  TDirectoryHandle extends DirectoryHandleLike = FileSystemDirectoryHandle
> {
  getDirectoryHandle(): Promise<TDirectoryHandle | null>;
  setDirectoryHandle(handle: TDirectoryHandle): Promise<void>;
  clearDirectoryHandle(): Promise<void>;
}
