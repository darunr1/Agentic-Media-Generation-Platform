/** Operator-configured estimates; unknown prices are explicitly labeled, never presented as free. */
export function estimateTextCost(provider: string, input: number, output: number) {
  const prefix = provider.toUpperCase();
  const inputRate = Number(process.env[`${prefix}_INPUT_CENTS_PER_MILLION`]);
  const outputRate = Number(process.env[`${prefix}_OUTPUT_CENTS_PER_MILLION`]);
  const costKnown =
    Number.isFinite(inputRate) && inputRate >= 0 && Number.isFinite(outputRate) && outputRate >= 0;
  return {
    costCents: costKnown ? Math.ceil((input * inputRate + output * outputRate) / 1_000_000) : 0,
    costEstimated: true,
    costKnown,
  };
}
