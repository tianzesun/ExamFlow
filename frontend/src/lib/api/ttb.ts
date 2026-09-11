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

export async function syncTTBCourses(semester: string = "20269"): Promise<TTBSyncResponse> {
  return fetchApi<TTBSyncResponse>(`/api/ttb/sync?semester=${semester}`, {
    method: "POST",
  });
}
