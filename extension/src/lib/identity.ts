export async function getInstallId(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get('install_id');
    if (data.install_id) {
      return data.install_id;
    }
    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ install_id: newId });
    return newId;
  }
  return 'dev-install-id-0000-0000-000000000000';
}

export async function getChatVersion(pageId: string): Promise<number> {
  const key = `chat_ver_${pageId}`;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(key);
    return data[key] || 1;
  }
  return 1;
}

export async function bumpChatVersion(pageId: string): Promise<number> {
  const current = await getChatVersion(pageId);
  const next = current + 1;
  const key = `chat_ver_${pageId}`;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [key]: next });
  }
  return next;
}
