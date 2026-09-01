export function calcTotal(input: { basePrice: number; gst?: number; stampDuty?: number; otherCharges?: Record<string, number> }) {
  const others = input.otherCharges ? Object.values(input.otherCharges).reduce((a, b) => a + b, 0) : 0
  return (input.basePrice ?? 0) + (input.gst ?? 0) + (input.stampDuty ?? 0) + others
}
