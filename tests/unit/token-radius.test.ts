import { describe, it } from "vitest"
import { scan, expectNoViolations } from "../helpers/source-scan"

const ARBITRARY_RADIUS = /rounded-\[\d+px\]/
const OFF_SCALE_RADIUS =
    /(?<![\w-])rounded-(?:[strblexy]{1,2}-)?(?:lg|xl|2xl|3xl|4xl)(?![\w-])/

describe("radius conformance", () => {
  it("uses no arbitrary px radius in conformance scope", () => {
    expectNoViolations(scan(ARBITRARY_RADIUS), "arbitrary radius")
  })

  it("uses no off-scale radius in conformance scope", () => {
    expectNoViolations(scan(OFF_SCALE_RADIUS), "off-scale radius")
  })
})
