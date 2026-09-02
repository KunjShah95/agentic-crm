export type Locale = "en" | "gu" | "hi"

export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    lead_ack: "Thanks for your interest, we will call within 4 hours.",
    cost_sheet: "Cost sheet for your unit",
    visit_reminder: "Site visit reminder — tomorrow 11 AM",
    demand_letter: "Demand letter — payment due",
    sites_title: "Available homes",
    enquiry_ok: "Thank you! Our team will contact you shortly.",
    buyer_portal: "Buyer Portal",
  },
  gu: {
    lead_ack: "તમારા રસ બદલ આભાર, અમે 4 કલાકમાં કૉલ કરીશું.",
    cost_sheet: "તમારા યુનિટ માટે કોસ્ટ શીટ",
    visit_reminder: "સાઇટ વિઝિટ રિમાઇન્ડર — કાલે 11 વાગ્યે",
    demand_letter: "ડિમાન્ડ લેટર — ચુકવણી બાકી",
    sites_title: "ઉપલબ્ધ ઘરો",
    enquiry_ok: "આભાર! અમારી ટીમ ટૂંક સમયમાં સંપર્ક કરશે.",
    buyer_portal: "બાયર પોર્ટલ",
  },
  hi: {
    lead_ack: "आपकी रुचि के लिए धन्यवाद, हम 4 घंटे में कॉल करेंगे।",
    cost_sheet: "आपकी यूनिट के लिए कॉस्ट शीट",
    visit_reminder: "साइट विज़िट रिमाइंडर — कल 11 बजे",
    demand_letter: "डिमांड लेटर — भुगतान देय",
    sites_title: "उपलब्ध घर",
    enquiry_ok: "धन्यवाद! हमारी टीम जल्द संपर्क करेगी।",
    buyer_portal: "बायर पोर्टल",
  },
}

export function t(locale: Locale, key: string): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key
}

export const whatsappTemplates: Record<string, Record<Locale, string>> = {
  lead_ack: { en: "Hello {{1}}, thanks for enquiring about {{2}}.", gu: "નમસ્તે {{1}}, {{2}} માં રસ બદલ આભાર.", hi: "नमस्ते {{1}}, {{2}} में रुचि के लिए धन्यवाद।" },
  cost_sheet: { en: "Cost sheet for {{1}} — total {{2}}", gu: "{{1}} માટે કોસ્ટ શીટ — કુલ {{2}}", hi: "{{1}} के लिए कॉस्ट शीट — कुल {{2}}" },
  visit_reminder: { en: "Reminder: site visit {{1}} tomorrow 11 AM", gu: "રિમાઇન્ડર: કાલે 11 વાગ્યે સાઇટ વિઝિટ {{1}}", hi: "रिमाइंडर: कल 11 बजे साइट विज़िट {{1}}" },
}
