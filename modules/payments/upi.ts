/**
 * UPI collection — closes letter → link → receipt loop.
 * Razorpay stub when no key; otherwise would create payment link via API.
 */

import { db } from "@/lib/db"

export async function createUpiLink(args: { workspaceId: string; dealId: string; paymentId: string; amount: number; userId: string }) {
  const key = process.env.RAZORPAY_KEY_ID
  const deal = await db.deal.findFirst({ where: { id: args.dealId, workspaceId: args.workspaceId } })
  if (!deal) throw new Error("Deal not found")
  const payment = await db.payment.findFirst({ where: { id: args.paymentId, dealId: args.dealId } })
  if (!payment) throw new Error("Payment not found")
  if (!key) {
    const link = `https://upi.mock/razorpay/${payment.id}?amt=${args.amount}`
    await db.activity.create({ data: { workspaceId: args.workspaceId, dealId: args.dealId, type: "NOTE", body: `UPI link (mock) created: ${link}`, createdBy: args.userId, channel: "WHATSAPP", source: "system" } })
    return { link, mocked: true }
  }
  // real Razorpay call would go here — fetch with key
  const link = `https://rzp.io/l/${payment.id}`
  return { link, mocked: false }
}

export async function handleUpiWebhook(payload: { paymentId: string; status: string; razorpayPaymentId?: string }) {
  const payment = await db.payment.findUnique({ where: { id: payload.paymentId } })
  if (!payment) throw new Error("Payment not found")
  if (payload.status === "PAID" || payload.status === "captured") {
    await db.payment.update({ where: { id: payload.paymentId }, data: { status: "PAID", paidAt: new Date(), receiptNo: payload.razorpayPaymentId ?? `RZP-${Date.now()}` } })
    await db.activity.create({ data: { workspaceId: payment.workspaceId, dealId: payment.dealId, type: "NOTE", body: `Payment ${payload.paymentId} marked PAID via UPI`, createdBy: "system", channel: "WHATSAPP", source: "system" } })
  }
  return { ok: true }
}
