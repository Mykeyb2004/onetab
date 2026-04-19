function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function formatSessionTitle(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `保存于 ${year}-${month}-${day} ${hours}:${minutes}`;
}
