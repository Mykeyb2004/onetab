const SUPPORTED_PROTOCOLS = new Set(["http:", "https:", "file:"]);

export function isSupportedTabUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return SUPPORTED_PROTOCOLS.has(parsedUrl.protocol);
  } catch {
    return false;
  }
}
