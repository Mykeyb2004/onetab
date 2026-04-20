type FileSystemPermissionMode = "read" | "readwrite";

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: FileSystemPermissionMode;
}

interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
