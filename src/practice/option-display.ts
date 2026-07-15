export function formatOptionContent(option: string): string {
  return option.replace(/^\s*[A-Z]\s*[.．、]\s*/i, "");
}
