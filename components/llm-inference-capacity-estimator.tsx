"use client";

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { estimateLlmInferenceCapacity, type LlmCapacityInputs } from "@/lib/domain/llm-inference-capacity";

const INITIAL_VALUES: LlmCapacityInputs = {
  parametersBillions: 70,
  weightBytesPerParameter: 2,
  layers: 80,
  keyValueHeads: 8,
  headDimension: 128,
  keyValueBytesPerElement: 2,
  gpusPerReplica: 4,
  gpuMemoryGiB: 80,
  usableGpuMemoryPercent: 90,
  runtimeReserveGiB: 20,
  activeSequences: 8,
  promptTokens: 1_000,
  maxPromptTokens: 4_000,
  averageOutputTokens: 500,
  maxOutputTokens: 1_500,
  requestsPerSecond: 3,
};

const numberFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const integerFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

function formatGiB(value: number) {
  return numberFormat.format(value) + " GiB";
}

function NumberField({
  id,
  label,
  value,
  min = 0,
  max,
  step = 1,
  unit,
  onChange,
}: {
  id: keyof LlmCapacityInputs;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (id: keyof LlmCapacityInputs, value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[0.875rem] font-medium">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input
          id={id}
          className="field min-w-0 flex-1"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(id, Number(event.target.value))}
        />
        {unit && <span className="text-[0.75rem] text-ink-3">{unit}</span>}
      </span>
    </label>
  );
}

function PrecisionField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: "weightBytesPerParameter" | "keyValueBytesPerElement";
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (id: keyof LlmCapacityInputs, value: number) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[0.875rem] font-medium">{label}</span>
      <select
        id={id}
        className="field mt-1 w-full"
        value={value}
        onChange={(event) => onChange(id, Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LlmInferenceCapacityEstimator() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const trackedUse = useRef(false);
  const result = estimateLlmInferenceCapacity(values);
  const invalid =
    values.parametersBillions < 0.1 ||
    values.layers < 1 ||
    values.keyValueHeads < 1 ||
    values.headDimension < 1 ||
    values.gpusPerReplica < 1 ||
    values.gpuMemoryGiB < 1 ||
    values.usableGpuMemoryPercent < 1 ||
    values.usableGpuMemoryPercent > 100 ||
    values.activeSequences < 1 ||
    values.promptTokens < 1 ||
    values.maxPromptTokens < 1 ||
    values.averageOutputTokens < 1 ||
    values.maxOutputTokens < 1 ||
    Object.values(values).some((value) => !Number.isFinite(value) || value < 0);
  const activeSequenceFits = values.activeSequences <= result.estimatedMaxSequences;

  function updateValue(id: keyof LlmCapacityInputs, value: number) {
    if (!trackedUse.current) {
      trackedUse.current = true;
      track("llm_capacity_estimator_used");
    }
    setValues((current) => ({ ...current, [id]: value }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="space-y-6">
        <fieldset className="sheet p-4 sm:p-5">
          <legend className="px-1 font-heading text-[1.125rem]">Model memory assumptions</legend>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <NumberField id="parametersBillions" label="Model parameters" value={values.parametersBillions} min={0.1} step={0.1} unit="billion" onChange={updateValue} />
            <PrecisionField
              id="weightBytesPerParameter"
              label="Weight storage"
              value={values.weightBytesPerParameter}
              options={[
                { value: 2, label: "16-bit · 2 bytes / parameter" },
                { value: 1, label: "8-bit · 1 byte / parameter" },
                { value: 0.5, label: "4-bit · about 0.5 bytes / parameter" },
              ]}
              onChange={updateValue}
            />
            <NumberField id="layers" label="Transformer layers" value={values.layers} min={1} unit="layers" onChange={updateValue} />
            <NumberField id="keyValueHeads" label="Key/value heads per layer" value={values.keyValueHeads} min={1} unit="heads" onChange={updateValue} />
            <NumberField id="headDimension" label="Head dimension" value={values.headDimension} min={1} unit="elements" onChange={updateValue} />
            <PrecisionField
              id="keyValueBytesPerElement"
              label="KV-cache precision"
              value={values.keyValueBytesPerElement}
              options={[
                { value: 2, label: "16-bit · 2 bytes / value" },
                { value: 1, label: "8-bit · 1 byte / value" },
              ]}
              onChange={updateValue}
            />
          </div>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-3">
            Use the model&apos;s KV-head count (which may be lower than its query-head count with grouped-query attention).
            Quantized weights need extra space for scales and metadata; include that and other runtime memory in the reserve below.
          </p>
        </fieldset>

        <fieldset className="sheet p-4 sm:p-5">
          <legend className="px-1 font-heading text-[1.125rem]">GPU pool and request workload</legend>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <NumberField id="gpusPerReplica" label="GPUs in one model replica" value={values.gpusPerReplica} min={1} unit="GPUs" onChange={updateValue} />
            <NumberField id="gpuMemoryGiB" label="Memory per GPU" value={values.gpuMemoryGiB} min={1} step={0.5} unit="GiB" onChange={updateValue} />
            <NumberField id="usableGpuMemoryPercent" label="Usable GPU-memory fraction" value={values.usableGpuMemoryPercent} min={1} max={100} unit="%" onChange={updateValue} />
            <NumberField id="runtimeReserveGiB" label="Runtime and workspace reserve" value={values.runtimeReserveGiB} min={0} step={0.5} unit="GiB" onChange={updateValue} />
            <NumberField id="activeSequences" label="Target active sequences" value={values.activeSequences} min={1} unit="sequences" onChange={updateValue} />
            <NumberField id="requestsPerSecond" label="Request rate" value={values.requestsPerSecond} min={0} step={0.1} unit="requests / second" onChange={updateValue} />
            <NumberField id="promptTokens" label="Average prompt length" value={values.promptTokens} min={1} unit="tokens" onChange={updateValue} />
            <NumberField id="maxPromptTokens" label="Prompt budget per sequence" value={values.maxPromptTokens} min={1} unit="tokens" onChange={updateValue} />
            <NumberField id="averageOutputTokens" label="Average output length" value={values.averageOutputTokens} min={1} unit="tokens" onChange={updateValue} />
            <NumberField id="maxOutputTokens" label="Reserved output budget" value={values.maxOutputTokens} min={1} unit="tokens" onChange={updateValue} />
          </div>
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-3">
            GPU count means the devices in one tensor-parallel model replica, not the total fleet. For multiple replicas,
            estimate one replica first, then multiply the fleet capacity separately.
          </p>
        </fieldset>
      </div>

      <aside className="sheet h-fit p-4 sm:p-5" aria-labelledby="estimate-results">
        <h2 id="estimate-results" className="font-heading text-[1.25rem]">Interview estimate</h2>
        {invalid ? (
          <p role="alert" className="mt-4 text-[0.9375rem] text-signal-gap">
            Enter valid positive values for model, GPU, sequence, and token fields.
          </p>
        ) : (
          <>
            <div className="mt-4 border-y border-rule">
              <div className="flex justify-between gap-4 py-3">
                <span className="text-[0.875rem] text-ink-2">Model weights</span>
                <strong className="text-[0.9375rem] tabular-nums">{formatGiB(result.modelWeightsGiB)}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule-soft py-3">
                <span className="text-[0.875rem] text-ink-2">KV cache per token</span>
                <strong className="text-[0.9375rem] tabular-nums">{numberFormat.format(result.kvCacheBytesPerToken / 1_048_576)} MiB</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule-soft py-3">
                <span className="text-[0.875rem] text-ink-2">KV cache per active sequence</span>
                <strong className="text-[0.9375rem] tabular-nums">{formatGiB(result.kvCacheGiBPerSequence)}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule-soft py-3">
                <span className="text-[0.875rem] text-ink-2">KV cache for target concurrency</span>
                <strong className="text-[0.9375rem] tabular-nums">{formatGiB(result.requestedKvCacheGiB)}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule-soft py-3">
                <span className="text-[0.875rem] text-ink-2">Approx. max active sequences</span>
                <strong className="text-[0.9375rem] tabular-nums">{integerFormat.format(result.estimatedMaxSequences)}</strong>
              </div>
            </div>

            <p className="mt-4 rounded-md border border-rule bg-panel px-3 py-2 text-[0.875rem] leading-relaxed" aria-live="polite">
              {activeSequenceFits
                ? "The target concurrency fits in about " + numberFormat.format(result.headroomGiB) + " GiB of estimated headroom."
                : "The target concurrency exceeds the estimated KV budget by " + formatGiB(result.requestedKvCacheGiB - result.availableKvCacheGiB) + "."}
            </p>

            <div className="mt-5">
              <h3 className="text-[0.875rem] font-medium">Workload to benchmark</h3>
              <dl className="mt-2 space-y-2 text-[0.875rem]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Prompt processing</dt>
                  <dd className="font-medium tabular-nums">{integerFormat.format(result.inputTokensPerSecond)} input tokens/s</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-2">Token generation</dt>
                  <dd className="font-medium tabular-nums">{integerFormat.format(result.outputTokensPerSecond)} output tokens/s</dd>
                </div>
              </dl>
            </div>
          </>
        )}
        <p className="mt-5 text-[0.8125rem] leading-relaxed text-ink-3">
          This is a back-of-the-envelope memory estimate, not a GPU count or throughput prediction. It assumes full attention,
          no shared-prefix cache savings, and evenly sharded weights/cache across the GPUs. Real fit and throughput depend on
          the model architecture, runtime, batch policy, kernels, parallelism, and measured workload. Benchmark on the target
          hardware before sizing production capacity.
        </p>
      </aside>
    </div>
  );
}
