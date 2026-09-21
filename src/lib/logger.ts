export function logRequest(fields: {
  requestId: string;
  route: string;
  userId?: string | null;
  durationMs?: number;
  status?: number;
  error?: string;
}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      ...fields,
    })
  );
}

export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}
