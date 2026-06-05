export function randomSessionToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
