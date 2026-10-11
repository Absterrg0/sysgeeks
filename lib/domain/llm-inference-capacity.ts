const GIB = 1024 ** 3;
const BYTES_PER_BILLION_PARAMETERS = 1_000_000_000;

export type LlmCapacityInputs = {
  parametersBillions: number;
  weightBytesPerParameter: number;
  layers: number;
  keyValueHeads: number;
  headDimension: number;
  keyValueBytesPerElement: number;
  gpusPerReplica: number;
  gpuMemoryGiB: number;
  usableGpuMemoryPercent: number;
  runtimeReserveGiB: number;
  activeSequences: number;
  promptTokens: number;
  maxPromptTokens: number;
  averageOutputTokens: number;
  maxOutputTokens: number;
  requestsPerSecond: number;
};

export function estimateLlmInferenceCapacity(input: LlmCapacityInputs) {
  const totalGpuMemoryGiB = input.gpusPerReplica * input.gpuMemoryGiB;
  const usableGpuMemoryGiB = totalGpuMemoryGiB * (input.usableGpuMemoryPercent / 100);
  const modelWeightsGiB =
    (input.parametersBillions * BYTES_PER_BILLION_PARAMETERS * input.weightBytesPerParameter) / GIB;
  const contextTokens = input.maxPromptTokens + input.maxOutputTokens;
  const kvCacheBytesPerToken =
    2 * input.layers * input.keyValueHeads * input.headDimension * input.keyValueBytesPerElement;
  const kvCacheGiBPerSequence = (kvCacheBytesPerToken * contextTokens) / GIB;
  const availableKvCacheGiB = Math.max(usableGpuMemoryGiB - modelWeightsGiB - input.runtimeReserveGiB, 0);
  const estimatedMaxSequences =
    kvCacheGiBPerSequence > 0 ? Math.floor(availableKvCacheGiB / kvCacheGiBPerSequence) : 0;
  const requestedKvCacheGiB = kvCacheGiBPerSequence * input.activeSequences;
  const estimatedTotalGiB = modelWeightsGiB + input.runtimeReserveGiB + requestedKvCacheGiB;

  return {
    totalGpuMemoryGiB,
    usableGpuMemoryGiB,
    modelWeightsGiB,
    kvCacheBytesPerToken,
    kvCacheGiBPerSequence,
    availableKvCacheGiB,
    estimatedMaxSequences,
    requestedKvCacheGiB,
    estimatedTotalGiB,
    headroomGiB: usableGpuMemoryGiB - estimatedTotalGiB,
    inputTokensPerSecond: input.requestsPerSecond * input.promptTokens,
    outputTokensPerSecond: input.requestsPerSecond * input.averageOutputTokens,
  };
}
