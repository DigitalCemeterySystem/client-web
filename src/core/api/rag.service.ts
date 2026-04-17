import type {
  BiographyJob,
  BiographyRecord,
  PersonSearchJob,
  PersonSearchRequest,
  RelevantInfoRecord,
} from '@/types';

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('Content-Type') || '';
  const data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };
  if (!response.ok) {
    throw new Error(data.message || data.detail || 'Request failed');
  }
  return data as T;
}

export const personSearchService = {
  async createJob(payload: PersonSearchRequest): Promise<PersonSearchJob> {
    const response = await fetch('/internal-api/person-search/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(response);
  },

  async getJob(jobId: string): Promise<PersonSearchJob> {
    const response = await fetch(`/internal-api/person-search/jobs/${jobId}`, { cache: 'no-store' });
    return parseResponse(response);
  },

  async listRecords(): Promise<RelevantInfoRecord[]> {
    const response = await fetch('/internal-api/person-search/records', { cache: 'no-store' });
    return parseResponse(response);
  },

  getDownloadUrl(recordId: number): string {
    return `/internal-api/person-search/records/${recordId}/download`;
  },
};

export const biographyGenerationService = {
  async listSources(): Promise<RelevantInfoRecord[]> {
    const response = await fetch('/internal-api/biography-gen/sources', { cache: 'no-store' });
    return parseResponse(response);
  },

  async createJob(recordId: number, sentenceCount = 10): Promise<BiographyJob> {
    const response = await fetch('/internal-api/biography-gen/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_id: recordId, variants: 1, sentence_count: sentenceCount }),
    });
    return parseResponse(response);
  },

  async getJob(jobId: string): Promise<BiographyJob> {
    const response = await fetch(`/internal-api/biography-gen/jobs/${jobId}`, { cache: 'no-store' });
    return parseResponse(response);
  },

  async listBiographies(): Promise<BiographyRecord[]> {
    const response = await fetch('/internal-api/biography-gen', { cache: 'no-store' });
    return parseResponse(response);
  },
};
