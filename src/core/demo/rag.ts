import { NextRequest, NextResponse } from 'next/server';
import type { BiographyJob, BiographyRecord, PersonSearchJob, RelevantInfoRecord } from '@/types';
import { getDemoBurials } from '@/core/demo/data';

const timestamp = '2026-05-03T00:00:00.000Z';
const firstBurial = getDemoBurials()[0];
const secondBurial = getDemoBurials()[1] ?? firstBurial;

const records: RelevantInfoRecord[] = [
  {
    id: 1,
    fullName: firstBurial?.fullName,
    full_name: firstBurial?.fullName ?? 'Demo person',
    query: `${firstBurial?.fullName ?? 'Demo person'} biography`,
    request: {
      full_name: firstBurial?.fullName ?? 'Demo person',
      city: 'Novosibirsk',
      limit: 5,
    },
    urls: [
      {
        url: 'https://example.com/demo-source',
        title: 'Demo source for biography generation',
      },
    ],
    relevant_preview:
      firstBurial?.biography ??
      'Demo relevant text collected by the search service. In production this data is extracted from external sources.',
    relevant_text_length: firstBurial?.biography?.length ?? 164,
    created_at: timestamp,
  },
  {
    id: 2,
    fullName: secondBurial?.fullName,
    full_name: secondBurial?.fullName ?? 'Second demo person',
    query: `${secondBurial?.fullName ?? 'Second demo person'} biography`,
    request: {
      full_name: secondBurial?.fullName ?? 'Second demo person',
      city: 'Novosibirsk',
      limit: 5,
    },
    urls: [
      {
        url: 'https://example.com/second-demo-source',
        title: 'Second demo source',
      },
    ],
    relevant_preview: secondBurial?.biography ?? 'Second demo relevant text.',
    relevant_text_length: secondBurial?.biography?.length ?? 96,
    created_at: timestamp,
  },
];

function logs(stage: string) {
  return [
    {
      timestamp,
      stage: 'created',
      level: 'info' as const,
      message: 'Demo job created.',
    },
    {
      timestamp,
      stage,
      level: 'success' as const,
      message: 'Demo job completed without external API calls.',
    },
  ];
}

function makeSearchJob(id = 'demo-search-job', recordId = 1): PersonSearchJob {
  const record = records.find((item) => item.id === recordId) ?? records[0];
  return {
    id,
    status: 'succeeded',
    stage: 'done',
    request: {
      full_name: record.full_name,
      city: 'Novosibirsk',
      limit: 5,
    },
    query: record.query,
    urls: record.urls,
    record_id: record.id,
    relevant_preview: record.relevant_preview,
    relevant_text_length: record.relevant_text_length,
    logs: logs('done'),
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function biographyResult(source = records[0]) {
  const biography = `${source.full_name} is represented in this demo as a generated biography based on curated source text. The real service uses search results, entity extraction, fact comparison and metrics before saving the generated record.`;
  return {
    biography,
    source_entities: {
      PER: [source.full_name],
      DATE: ['2026'],
      LOC: ['Novosibirsk'],
      ORG: ['Digital Cemetery System'],
    },
    generated_entities: {
      PER: [source.full_name],
      DATE: ['2026'],
      LOC: ['Novosibirsk'],
      ORG: ['Digital Cemetery System'],
    },
    source_facts: [
      { subject: source.full_name, relation: 'has_demo_source', object: source.urls[0]?.url ?? 'demo source' },
    ],
    generated_facts: [
      { subject: source.full_name, relation: 'has_generated_biography', object: 'demo biography' },
    ],
    metrics: {
      entities: { coverage: 1, factuality: 1 },
      facts: { coverage: 0.92, factuality: 0.95 },
      final_score: 0.96,
    },
    report: {
      generated_entities: [
        { value: source.full_name, best_match: source.full_name, similarity: 1, status: 'true' as const },
      ],
      generated_facts: [
        { value: 'demo biography', best_match: 'demo biography', similarity: 0.95, status: 'true' as const },
      ],
      missing_source_entities: [],
      missing_source_facts: [],
      totals: { true: 2, review: 0, hallucination: 0 },
    },
  };
}

function makeBiographyJob(id = 'demo-biography-job', recordId = 1): BiographyJob {
  const source = records.find((item) => item.id === recordId) ?? records[0];
  return {
    id,
    status: 'succeeded',
    stage: 'done',
    request: { record_id: source.id, variants: 1, sentence_count: 10 },
    record_id: source.id,
    biography_id: source.id,
    result: biographyResult(source),
    logs: logs('done'),
    error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function biographies(): BiographyRecord[] {
  return records.map((record) => {
    const result = biographyResult(record);
    return {
      id: record.id,
      source_record_id: record.id,
      full_name: record.full_name,
      biography: result.biography,
      source_text_preview: record.relevant_preview,
      source_entities: result.source_entities,
      generated_entities: result.generated_entities,
      source_facts: result.source_facts,
      generated_facts: result.generated_facts,
      metrics: result.metrics,
      report: result.report,
      created_at: timestamp,
    };
  });
}

export async function handleDemoServiceRequest(request: NextRequest, backendPath: string) {
  const path = backendPath.replace(/^\/api/, '');

  if (path === '/search/jobs' && request.method === 'POST') {
    return NextResponse.json(makeSearchJob(`demo-search-${Date.now()}`), { status: 202 });
  }

  const searchJobMatch = path.match(/^\/search\/jobs\/([^/]+)$/);
  if (searchJobMatch) {
    return NextResponse.json(makeSearchJob(searchJobMatch[1]));
  }

  if (path === '/search/records') {
    return NextResponse.json(records);
  }

  const downloadMatch = path.match(/^\/search\/records\/(\d+)\/download$/);
  if (downloadMatch) {
    const record = records.find((item) => item.id === Number(downloadMatch[1])) ?? records[0];
    return new NextResponse(record.relevant_preview, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="demo-record-${record.id}.txt"`,
      },
    });
  }

  if (path === '/biographies/sources') {
    return NextResponse.json(records);
  }

  if (path === '/biographies/jobs' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { record_id?: number };
    return NextResponse.json(makeBiographyJob(`demo-biography-${Date.now()}`, body.record_id ?? 1), { status: 202 });
  }

  const biographyJobMatch = path.match(/^\/biographies\/jobs\/([^/]+)$/);
  if (biographyJobMatch) {
    return NextResponse.json(makeBiographyJob(biographyJobMatch[1]));
  }

  if (path === '/biographies') {
    return NextResponse.json(biographies());
  }

  const biographyMatch = path.match(/^\/biographies\/(\d+)$/);
  if (biographyMatch) {
    const biography = biographies().find((item) => item.id === Number(biographyMatch[1]));
    return biography
      ? NextResponse.json(biography)
      : NextResponse.json({ message: 'Biography not found.' }, { status: 404 });
  }

  return NextResponse.json({ message: `Demo service route is not implemented: ${request.method} ${path}` }, { status: 404 });
}

