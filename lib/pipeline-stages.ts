/**
 * What a pipeline stage *means*, as opposed to what it is called.
 *
 * `PipelineStage.kind` is the signal. `PipelineStage.name` is a label the user
 * is free to change, and every decision that used to be made against it — is
 * this deal won, does it count toward pipeline, when was it won — broke the
 * moment somebody typed "Closed Won" into the stage settings. It failed silently,
 * which is the only kind of failure that is worse than a crash: the dashboard
 * kept rendering confident numbers that were wrong.
 *
 * So: branch on `kind`, display `name`. Renames are now free.
 *
 * The one thing this still cannot do is be set correctly for stages that
 * existed before the column arrived — those were backfilled from their names by
 * migration `20261003150000_pipeline_stage_kind`, which is an inference, and a
 * workspace that had already renamed its stages to something unusual will have
 * them as `OPEN`. That is the safe direction to be wrong in (over-counting
 * pipeline rather than under-reporting revenue) and it is fixable by hand in
 * stage settings, which now exposes `kind`.
 */

export type StageKind = "OPEN" | "WON" | "LOST"

/** A deal in one of these stages has been decided — it is no longer in play. */
export function isClosedKind(kind: StageKind) {
  return kind === "WON" || kind === "LOST"
}

/** A deal in this stage still counts toward open pipeline. */
export function isOpenKind(kind: StageKind) {
  return !isClosedKind(kind)
}

export function isWonKind(kind: StageKind) {
  return kind === "WON"
}