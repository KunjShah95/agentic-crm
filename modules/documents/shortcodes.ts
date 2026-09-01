export function renderShortcodes(template: string, data: Record<string, string>) {
  let out = template
  for (const [k, v] of Object.entries(data)) out = out.replaceAll(`{{${k}}}`, v).replaceAll(`{{ ${k} }}`, v)
  return out
}
export const RE_SHORTCODES = ["rera_no","project_name","unit_no","carpet_area","built_up","total","base_price","gst","stamp_duty","buyer_name","booking_date"] as const
