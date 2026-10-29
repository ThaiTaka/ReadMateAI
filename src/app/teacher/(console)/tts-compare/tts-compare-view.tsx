import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { PocSample } from "@/server/tts/poc/manifest";
import { ALL_POC_SENTENCES } from "@/server/tts/poc/sentences";
import { POC_VOICES, POC_VOICE_KEYS } from "@/server/tts/poc/voices";
import { vi } from "@/strings/vi";
import { ExclusiveAudio } from "./exclusive-audio";

type TtsCompareViewProps = {
  samples: readonly PocSample[];
  problem: "NONE" | "MISSING" | "INVALID";
};

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/gu, (_, key: string) => values[key] ?? "");

const seconds = (ms: number): string => (ms / 1000).toFixed(1);
const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * So sánh giọng AI (R10.3b2-P0). CHỈ ĐỌC: không nút duyệt/chọn giọng, không lưu nhận xét. Âm thanh chỉ phát qua route
 * `/api/teacher/tts-poc/…` (đã xác thực giáo viên), không phát từ địa chỉ nhà cung cấp.
 */
export function TtsCompareView({ samples, problem }: TtsCompareViewProps) {
  const t = vi.ttsCompare;
  const voices = POC_VOICE_KEYS.map((key) => POC_VOICES[key]);
  const sampleCount = new Map<string, number>();
  for (const sample of samples) sampleCount.set(sample.voiceKey, (sampleCount.get(sample.voiceKey) ?? 0) + 1);
  // Bảng ghi nhận chỉ có cột cho giọng đã có tệp để nghe; chưa có tệp nào thì hiện tất cả ứng viên.
  const noteVoices = samples.length > 0 ? voices.filter((voice) => sampleCount.has(voice.key)) : voices;
  const groups = new Map<string, PocSample[]>();
  for (const sample of samples) {
    const key = `${sample.voiceKey}|${sample.speed}`;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Notice tone="progress" title={t.banner}>
        <p>{t.bannerText}</p>
      </Notice>

      {problem === "INVALID" ? (
        <Notice title={t.invalidTitle}>
          <p>{t.invalidText}</p>
        </Notice>
      ) : samples.length === 0 ? (
        <Notice title={t.emptyTitle}>
          <p>{t.emptyText}</p>
        </Notice>
      ) : null}

      <section aria-labelledby="poc-candidates" className="rounded-card border border-line bg-surface p-5">
        <h2 id="poc-candidates" className="text-lg font-bold text-ink">
          {t.candidatesTitle}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-ink">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4">
                  {t.candidateColumns.provider}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {t.candidateColumns.voice}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {t.candidateColumns.gender}
                </th>
                <th scope="col" className="py-2 pr-4">
                  {t.candidateColumns.region}
                </th>
                <th scope="col" className="py-2">
                  {t.candidateColumns.status}
                </th>
              </tr>
            </thead>
            <tbody>
              {voices.map((voice) => (
                <tr key={voice.key} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4">{t.providers[voice.provider]}</td>
                  <td className="py-2 pr-4 font-semibold">{voice.providerVoice}</td>
                  <td className="py-2 pr-4">{t.genders[voice.gender]}</td>
                  <td className="py-2 pr-4">{t.regions[voice.region]}</td>
                  <td className="py-2 text-ink-soft">
                    {sampleCount.get(voice.key)
                      ? fill(t.candidateStatus.hasSample, { n: String(sampleCount.get(voice.key)) })
                      : t.candidateStatus.noSample}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-soft">{t.candidatesNote}</p>
      </section>

      {samples.length > 0 ? (
        <>
          <section aria-labelledby="poc-sentences" className="flex flex-col gap-4">
            <h2 id="poc-sentences" className="text-lg font-bold text-ink">
              {t.sentencesTitle}
            </h2>
            <ExclusiveAudio>
              <ul className="flex flex-col gap-4">
                {ALL_POC_SENTENCES.map((sentence) => {
                  const forSentence = samples
                    .filter((sample) => sample.sentenceId === sentence.id)
                    .sort((a, b) => `${a.speed}${a.voiceKey}`.localeCompare(`${b.speed}${b.voiceKey}`));
                  if (forSentence.length === 0) return null;
                  return (
                    <li key={sentence.id}>
                      <Card as="article" aria-label={sentence.id} className="flex flex-col gap-3 p-5">
                        <p className="text-xl font-bold leading-relaxed text-ink">“{sentence.text}”</p>
                        <p className="text-sm text-ink-soft">{sentence.why}</p>
                        {sentence.kind === "diagnostic" ? <Badge tone="coral">{t.diagnosticNote}</Badge> : null}
                        <ul className="grid gap-3 sm:grid-cols-2">
                          {forSentence.map((sample) => {
                            const voice = POC_VOICES[sample.voiceKey];
                            return (
                              <li key={sample.requestKey} className="rounded-2xl border border-line p-3">
                                <p className="font-semibold text-ink">
                                  {voice.label} · {t.speeds[sample.speed]}
                                </p>
                                <p className="text-sm text-ink-soft">
                                  {fill(t.sampleMeta, {
                                    format: sample.format.toUpperCase(),
                                    seconds: seconds(sample.durationMs),
                                    kb: (sample.bytes / 1024).toFixed(0),
                                    latency: seconds(sample.latencyMs),
                                  })}
                                </p>
                                <audio
                                  controls
                                  preload="none"
                                  className="mt-2 w-full"
                                  src={`/api/teacher/tts-poc/${sample.file}`}
                                  aria-label={fill(t.playLabel, { voice: voice.label, speed: t.speeds[sample.speed] })}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </ExclusiveAudio>
          </section>

          <section aria-labelledby="poc-stats" className="rounded-card border border-line bg-surface p-5">
            <h2 id="poc-stats" className="text-lg font-bold text-ink">
              {t.statsTitle}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-ink">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-soft">
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.voice}
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.speed}
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.files}
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.latency}
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.size}
                    </th>
                    <th scope="col" className="py-2 pr-4">
                      {t.statsColumns.duration}
                    </th>
                    <th scope="col" className="py-2">
                      {t.statsColumns.cost}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...groups.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, group]) => {
                      const first = group[0]!;
                      return (
                        <tr key={key} className="border-b border-line last:border-0">
                          <td className="py-2 pr-4 font-semibold">{POC_VOICES[first.voiceKey].label}</td>
                          <td className="py-2 pr-4">{t.speeds[first.speed]}</td>
                          <td className="py-2 pr-4">{group.length}</td>
                          <td className="py-2 pr-4">{seconds(average(group.map((s) => s.latencyMs)))} giây</td>
                          <td className="py-2 pr-4">{(average(group.map((s) => s.bytes)) / 1024).toFixed(0)} KB</td>
                          <td className="py-2 pr-4">{seconds(average(group.map((s) => s.durationMs)))} giây</td>
                          <td className="py-2">{t.costUnknown}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section aria-labelledby="poc-notes" className="rounded-card border border-line bg-surface p-5">
        <h2 id="poc-notes" className="text-lg font-bold text-ink">
          {t.notesTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t.notesText}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-ink">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4">
                  <span className="sr-only">{t.notesTitle}</span>
                </th>
                {noteVoices.map((voice) => (
                  <th key={voice.key} scope="col" className="py-2 pr-4">
                    {voice.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.criteria.map((criterion) => (
                <tr key={criterion} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-4 font-normal">
                    {criterion}
                  </th>
                  {noteVoices.map((voice) => (
                    <td key={voice.key} className="py-2 pr-4 text-ink-soft">
                      {t.notesPending}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
