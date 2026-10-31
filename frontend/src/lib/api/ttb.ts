import { fetchApi } from "./client";

export interface TTBReferenceData {
  status: string;
  data: {
    sessions: Array<{ label: string; value: string }>;
    divisions: Array<{ label: string; value: string }>;
  };
}

export interface TTBSyncResponse {
  status: string;
  synced: number;
  semester: string;
}

export async function getTTBReferenceData(): Promise<TTBReferenceData> {
  return fetchApi<TTBReferenceData>("/api/ttb/reference-data");
}

/** Timetable Builder session code for a date: year + 1 (Winter), 5 (Summer) or 9 (Fall). */
export function currentSession(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  return `${now.getFullYear()}${month <= 4 ? 1 : month <= 8 ? 5 : 9}`;
}

export async function syncTTBCourses(semester: string = currentSession()): Promise<TTBSyncResponse> {
  return fetchApi<TTBSyncResponse>(`/api/ttb/sync?semester=${semester}`, {
    method: "POST",
  });
}
