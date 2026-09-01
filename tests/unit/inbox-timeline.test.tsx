import { render, screen } from "@testing-library/react"
import InboxTimeline from "@/components/inbox/InboxTimeline"
import { describe, it, expect } from "vitest"

describe("InboxTimeline", () => {
  it("renders inbound and outbound messages", () => {
    render(
      <InboxTimeline
        items={[
          { id: "1", body: "Interested in 3BHK", channel: "WHATSAPP", direction: "IN", createdAt: new Date() },
          { id: "2", body: "Sure, sending cost sheet", channel: "WHATSAPP", direction: "OUT", createdAt: new Date() },
        ]}
      />
    )
    expect(screen.getByText("Interested in 3BHK")).toBeInTheDocument()
    expect(screen.getByText("Sure, sending cost sheet")).toBeInTheDocument()
  })
  it("shows empty state", () => {
    render(<InboxTimeline items={[]} />)
    expect(screen.getByText("No messages yet.")).toBeInTheDocument()
  })
})
