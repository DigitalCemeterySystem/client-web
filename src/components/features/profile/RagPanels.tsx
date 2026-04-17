'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, ExternalLink, FileSearch, Play, RefreshCw, Sparkles } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { biographyGenerationService, personSearchService } from '@/core/api/rag.service';
import type {
  BiographyJob,
  ComparedItem,
  EntitySet,
  FactTriplet,
  PersonSearchJob,
  PersonSearchRequest,
  RagLogEntry,
  RelevantInfoRecord,
} from '@/types';

const searchStages = [
  { id: 'search', label: 'Поиск информации' },
  { id: 'parse', label: 'Парсинг страниц' },
  { id: 'extract', label: 'Извлечение релевантной информации' },
  { id: 'done', label: 'Готово' },
];

const biographyStages = [
  { id: 'generate', label: 'Генерация биографии' },
  { id: 'extract_source', label: 'Сущности и факты исходного текста' },
  { id: 'extract_generated', label: 'Сущности и факты биографии' },
  { id: 'metrics', label: 'Подсчет метрик' },
  { id: 'done', label: 'Готово' },
];

const entityLabels: Record<keyof EntitySet, string> = {
  PER: 'Персоны',
  DATE: 'Даты',
  LOC: 'Локации',
  ORG: 'Организации',
};

function isActiveJob(status?: string) {
  return status === 'pending' || status === 'running';
}

function statusText(status: string) {
  if (status === 'succeeded') return 'Завершено';
  if (status === 'failed') return 'Ошибка';
  if (status === 'running') return 'В процессе';
  return 'Ожидает запуска';
}

function LogList({ logs }: { logs: RagLogEntry[] }) {
  if (!logs.length) {
    return <p className="text-sm text-[color:var(--ink-muted)]">Логи появятся после запуска процесса.</p>;
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-3">
      {logs.map((log, index) => (
        <div key={`${log.timestamp}-${index}`} className="grid gap-1 rounded-xl bg-[color:var(--bg)] px-3 py-2 text-sm sm:grid-cols-[140px_1fr]">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">{log.stage}</span>
          <span
            className={[
              log.level === 'error' ? 'text-[#9e3024]' : '',
              log.level === 'success' ? 'text-[color:var(--accent-strong)]' : '',
              log.level === 'warning' ? 'text-[#8a5b12]' : '',
              log.level === 'info' ? 'text-[color:var(--ink)]' : '',
            ].join(' ')}
          >
            {log.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function StageList({ stages, currentStage, failed }: { stages: { id: string; label: string }[]; currentStage: string; failed: boolean }) {
  const currentIndex = stages.findIndex((stage) => stage.id === currentStage);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage, index) => {
        const completed = currentStage === 'done' || (currentIndex >= 0 && index < currentIndex);
        const active = stage.id === currentStage;
        return (
          <div
            key={stage.id}
            className={[
              'rounded-2xl border px-4 py-3 text-sm',
              failed && active
                ? 'border-[#d04f3f] bg-[#d04f3f]/10 text-[#9e3024]'
                : completed
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]'
                  : active
                    ? 'border-[color:var(--accent)] bg-[color:var(--bg-panel)] text-[color:var(--ink)]'
                    : 'border-[color:var(--line)] bg-[color:var(--bg-panel)] text-[color:var(--ink-muted)]',
            ].join(' ')}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em]">Этап {index + 1}</p>
            <p className="mt-1 font-semibold">{stage.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function EntityBox({ title, entities }: { title: string; entities?: EntitySet | null }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
      <h3 className="font-semibold text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(Object.keys(entityLabels) as (keyof EntitySet)[]).map((key) => (
          <div key={key}>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ink-muted)]">{entityLabels[key]}</p>
            <p className="mt-1 text-sm text-[color:var(--ink)]">{entities?.[key]?.length ? entities[key].join(', ') : 'Не извлечено'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactBox({ title, facts }: { title: string; facts?: FactTriplet[] | null }) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
      <h3 className="font-semibold text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm text-[color:var(--ink)]">
        {facts?.length ? (
          facts.map((fact, index) => (
            <p key={`${fact.subject}-${fact.relation}-${index}`}>
              {fact.subject} - {fact.relation} - {fact.object}
            </p>
          ))
        ) : (
          <p className="text-[color:var(--ink-muted)]">Факты пока не извлечены.</p>
        )}
      </div>
    </div>
  );
}

function ReportList({ title, items }: { title: string; items?: ComparedItem[] }) {
  const labelByStatus = {
    true: 'Достоверно',
    review: 'На рассмотрение',
    hallucination: 'Галлюцинация',
  };

  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
      <h3 className="font-semibold text-[color:var(--ink)]">{title}</h3>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {items?.length ? (
          items.map((item, index) => (
            <div key={`${item.value}-${index}`} className="rounded-xl bg-[color:var(--bg)] p-3 text-sm">
              <p className="font-medium text-[color:var(--ink)]">{item.value}</p>
              <p className="mt-1 text-[color:var(--ink-muted)]">
                {labelByStatus[item.status]} · сходство {item.similarity.toFixed(3)}
                {item.best_match ? ` · ближайший факт: ${item.best_match}` : ''}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[color:var(--ink-muted)]">Отчет появится после подсчета метрик.</p>
        )}
      </div>
    </div>
  );
}

export function SearchInformationPanel() {
  const [form, setForm] = useState<PersonSearchRequest>({
    full_name: '',
    city: 'Новосибирск',
    birth_date: '',
    death_date: '',
    cemetery: '',
    extra_terms: '',
    limit: 5,
  });
  const [job, setJob] = useState<PersonSearchJob | null>(null);
  const [records, setRecords] = useState<RelevantInfoRecord[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  async function loadRecords() {
    const loaded = await personSearchService.listRecords();
    setRecords(loaded);
  }

  useEffect(() => {
    loadRecords().catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить записи.'));
  }, []);

  useEffect(() => {
    if (!job || !isActiveJob(job.status)) return undefined;
    const interval = window.setInterval(async () => {
      const nextJob = await personSearchService.getJob(job.id);
      setJob(nextJob);
      if (nextJob.status === 'succeeded') {
        loadRecords().catch(() => undefined);
      }
    }, 1600);
    return () => window.clearInterval(interval);
  }, [job]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setExpanded(false);

    try {
      const payload = {
        ...form,
        full_name: form.full_name.trim(),
        city: form.city?.trim() || undefined,
        birth_date: form.birth_date?.trim() || undefined,
        death_date: form.death_date?.trim() || undefined,
        cemetery: form.cemetery?.trim() || undefined,
        extra_terms: form.extra_terms?.trim() || undefined,
      };
      const created = await personSearchService.createJob(payload);
      setJob(created);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось запустить поиск.');
    }
  }

  const currentStage = job?.stage || 'search';
  const failed = job?.status === 'failed';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="surface-muted rounded-3xl p-6 sm:p-8">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[color:var(--ink)]">
          <FileSearch className="h-5 w-5 text-[color:var(--accent-strong)]" />
          Поиск информации
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <input required value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="ФИО" />
          <input value={form.city || ''} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="Город" />
          <input value={form.birth_date || ''} onChange={(event) => setForm((current) => ({ ...current, birth_date: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="Дата рождения" />
          <input value={form.death_date || ''} onChange={(event) => setForm((current) => ({ ...current, death_date: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="Дата смерти" />
          <input value={form.cemetery || ''} onChange={(event) => setForm((current) => ({ ...current, cemetery: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="Кладбище" />
          <input value={form.extra_terms || ''} onChange={(event) => setForm((current) => ({ ...current, extra_terms: event.target.value }))} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]" placeholder="Дополнительные слова" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="text-sm text-[color:var(--ink-muted)]">
            Страниц:
            <input type="number" min={1} max={10} value={form.limit} onChange={(event) => setForm((current) => ({ ...current, limit: Number(event.target.value) }))} className="ml-2 w-20 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-2 text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]" />
          </label>
          <button disabled={isActiveJob(job?.status)} className="pill-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {isActiveJob(job?.status) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Запустить поиск
          </button>
        </div>
        {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}
      </form>

      {job && (
        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[color:var(--ink)]">Процесс поиска</h2>
            <span className="rounded-full bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-muted)]">{statusText(job.status)}</span>
          </div>
          <div className="mt-5">
            <StageList stages={searchStages} currentStage={currentStage} failed={failed} />
          </div>
          {job.urls.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
              <h3 className="font-semibold text-[color:var(--ink)]">Найденные страницы</h3>
              <div className="mt-3 space-y-2">
                {job.urls.map((item) => (
                  <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 break-all text-sm font-medium text-[color:var(--accent-strong)] hover:underline">
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                    {item.title || item.url}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="mt-5">
            <LogList logs={job.logs} />
          </div>
          {job.status === 'succeeded' && job.record_id && (
            <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
              <p className="font-semibold text-[color:var(--ink)]">Релевантная информация извлечена.</p>
              <p className="mt-2 text-sm text-[color:var(--ink-muted)]">Символов: {job.relevant_text_length}</p>
              <button type="button" onClick={() => setExpanded((current) => !current)} className="mt-3 text-sm font-semibold text-[color:var(--accent-strong)]">
                {expanded ? 'Скрыть фрагмент' : 'Показать фрагмент'}
              </button>
              {expanded && <p className="mt-3 whitespace-pre-wrap break-all text-sm text-[color:var(--ink)]">{job.relevant_preview}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={personSearchService.getDownloadUrl(job.record_id)} className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-elevated)]">
                  <Download className="h-4 w-4" />
                  Скачать файл
                </a>
                <Link href={`/profile/biographies?recordId=${job.record_id}`} className="pill-action px-4 py-2 text-sm font-semibold">
                  Перейти к генерации биографии
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="surface-muted rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-[color:var(--ink)]">Сохраненная релевантная информация</h2>
        <div className="mt-4 space-y-3">
          {records.length ? (
            records.map((record) => (
              <div key={record.id} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
                <p className="font-semibold text-[color:var(--ink)]">{record.full_name}</p>
                <p className="mt-1 whitespace-pre-wrap break-all text-sm text-[color:var(--ink-muted)]">{record.relevant_preview}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={personSearchService.getDownloadUrl(record.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:bg-[color:var(--bg-elevated)]"
                  >
                    <Download className="h-4 w-4" />
                    Скачать
                  </a>
                  <Link
                    href={`/profile/biographies?recordId=${record.id}`}
                    className="pill-action inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Генерировать биографию
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[color:var(--ink-muted)]">Сохраненных записей пока нет.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export function BiographyGenerationPanel() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<RelevantInfoRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [sentenceCount, setSentenceCount] = useState(10);
  const [job, setJob] = useState<BiographyJob | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    biographyGenerationService
      .listSources()
      .then((loaded) => {
        setSources(loaded);
        const fromQuery = Number(searchParams.get('recordId'));
        if (Number.isFinite(fromQuery) && loaded.some((record) => record.id === fromQuery)) {
          setSelectedId(fromQuery);
        } else if (loaded[0]) {
          setSelectedId(loaded[0].id);
        }
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Не удалось загрузить источники.'));
  }, [searchParams]);

  useEffect(() => {
    if (!job || !isActiveJob(job.status)) return undefined;
    const interval = window.setInterval(async () => {
      setJob(await biographyGenerationService.getJob(job.id));
    }, 1800);
    return () => window.clearInterval(interval);
  }, [job]);

  async function handleGenerate() {
    if (!selectedId) {
      setError('Выберите запись с релевантной информацией.');
      return;
    }
    setError('');
    try {
      setJob(await biographyGenerationService.createJob(selectedId, sentenceCount));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось запустить генерацию.');
    }
  }

  const selectedSource = useMemo(() => sources.find((source) => source.id === selectedId), [selectedId, sources]);

  return (
    <div className="space-y-6">
      <section className="surface-muted rounded-3xl p-6 sm:p-8">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[color:var(--ink)]">
          <Sparkles className="h-5 w-5 text-[color:var(--accent-strong)]" />
          Генерация биографий
        </h2>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto_auto]">
          <select value={selectedId} onChange={(event) => setSelectedId(Number(event.target.value) || '')} className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-4 py-3 outline-none focus:border-[color:var(--accent)]">
            <option value="">Выберите человека</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.full_name} · запись #{source.id}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[color:var(--ink-muted)]">
            Предложений
            <input type="number" min={5} max={15} value={sentenceCount} onChange={(event) => setSentenceCount(Number(event.target.value))} className="w-24 rounded-xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] px-3 py-2 text-[color:var(--ink)] outline-none focus:border-[color:var(--accent)]" />
          </label>
          <button type="button" disabled={isActiveJob(job?.status)} onClick={handleGenerate} className="pill-action inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {isActiveJob(job?.status) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Запустить генерацию
          </button>
        </div>

        {selectedSource && <p className="mt-4 whitespace-pre-wrap break-all text-sm text-[color:var(--ink-muted)]">{selectedSource.relevant_preview}</p>}
        {error && <p className="mt-4 rounded-2xl bg-[#d04f3f]/10 px-4 py-3 text-sm text-[#9e3024]">{error}</p>}
      </section>

      {job && (
        <section className="surface-muted rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[color:var(--ink)]">Процесс генерации</h2>
            <span className="rounded-full bg-[color:var(--bg-panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink-muted)]">{statusText(job.status)}</span>
          </div>
          <div className="mt-5">
            <StageList stages={biographyStages} currentStage={job.stage} failed={job.status === 'failed'} />
          </div>
          <div className="mt-5">
            <LogList logs={job.logs} />
          </div>

          {job.result.biography && (
            <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
              <h3 className="font-semibold text-[color:var(--ink)]">Биография</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">{job.result.biography}</p>
            </div>
          )}

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <EntityBox title="Сущности исходного текста" entities={job.result.source_entities} />
            <EntityBox title="Сущности биографии" entities={job.result.generated_entities} />
            <FactBox title="Факты исходного текста" facts={job.result.source_facts} />
            <FactBox title="Факты биографии" facts={job.result.generated_facts} />
          </div>

          {job.result.metrics && (
            <div className="mt-5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-panel)] p-4">
              <h3 className="font-semibold text-[color:var(--ink)]">Метрики</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <p className="text-sm text-[color:var(--ink)]">Сущности: coverage {job.result.metrics.entities.coverage}, factuality {job.result.metrics.entities.factuality}</p>
                <p className="text-sm text-[color:var(--ink)]">Факты: coverage {job.result.metrics.facts.coverage}, factuality {job.result.metrics.facts.factuality}</p>
                <p className="text-sm font-semibold text-[color:var(--accent-strong)]">Итог: {job.result.metrics.final_score}</p>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <ReportList title="Проверка сущностей биографии" items={job.result.report?.generated_entities} />
                <ReportList title="Проверка фактов биографии" items={job.result.report?.generated_facts} />
              </div>
              {job.result.report && (
                <p className="mt-4 text-sm text-[color:var(--ink-muted)]">
                  Достоверно: {job.result.report.totals.true}, на рассмотрение: {job.result.report.totals.review}, галлюцинации: {job.result.report.totals.hallucination}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
