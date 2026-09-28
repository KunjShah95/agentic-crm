import { SectionHeader } from "@/components/landing/section-header"
import { Building2, Phone, Handshake, Navigation, ReceiptText } from "lucide-react"

/**
 * One loop, every role.
 *
 * Layout family: a hairline-ruled spec table, not five cards. Five equal cards
 * is the same grid mistake the workflows section just fixed, and a role matrix
 * is genuinely tabular data — roles down, what each one sees across. Card
 * chrome was flattening real hierarchy here.
 *
 * Bug fixed in this pass: the Accounts row shipped the literal string
 * "{{rera_no}}" to users, an unrendered template placeholder.
 */
const ROLES = [
  {
    role: "Owner / Director",
    icon: Building2,
    sees: "Funnel, inventory health, collections, team versus target",
    detail: "Spreadsheet-free",
  },
  {
    role: "Sales Manager",
    icon: Phone,
    sees: "Kanban, activity log, cost sheets, WhatsApp acknowledgements",
    detail: "HOLD to booking in 48s",
  },
  {
    role: "Broker / Channel Partner",
    icon: Handshake,
    sees: "Only their allocated units, with commission and referral ledger",
    detail: "Scoped allocation",
  },
  {
    role: "Site Engineer",
    icon: Navigation,
    sees: "Scheduled visits, 200m GPS check-in, offline capture",
    detail: "Works without network",
  },
  {
    role: "Accounts",
    icon: ReceiptText,
    sees: "CLP milestones, RERA demand notices, UPI payment links, Tally export",
    detail: "Demand notice in 9s",
  },
]

export function StaffSection() {
  return (
    <section id="staff" className="bg-background">
      <div className="mx-auto max-w-[1280px] px-6 py-20 lg:px-8 lg:py-28">
        <SectionHeader
          title="Built for how Ahmedabad builds."
          body="Five roles, one workspace, one loop. Each opens to the screen they actually work in, and every query is scoped to their workspaceId."
        />

        <div className="mt-12">
          {/* Column headers. Hidden on mobile, where the table collapses to
              stacked role blocks. */}
          <div className="hidden grid-cols-[1.1fr_1.6fr_0.9fr] gap-6 border-b border-border pb-3 lg:grid">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Role
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              What they open
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Detail
            </p>
          </div>

          <ul className="rule-y">
            {ROLES.map((r) => {
              const Icon = r.icon
              return (
                <li
                  key={r.role}
                  className="grid grid-cols-1 items-baseline gap-x-6 gap-y-1.5 py-5 transition-colors hover:bg-surface-sunken lg:grid-cols-[1.1fr_1.6fr_0.9fr] lg:items-center lg:gap-y-0 lg:px-2"
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="size-4 shrink-0 text-brand" aria-hidden />
                    <span className="text-[15px] font-semibold tracking-[-0.01em]">
                      {r.role}
                    </span>
                  </span>
                  <span className="text-[14px] leading-6 text-muted-foreground lg:pr-8">
                    {r.sees}
                  </span>
                  <span className="text-[12px] text-foreground">{r.detail}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="mt-8 text-[13px] text-muted-foreground">
          Gujarati, Hindi and English throughout — WhatsApp templates, cost
          sheets and public buyer sites.
        </p>
      </div>
    </section>
  )
}
