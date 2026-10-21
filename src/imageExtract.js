const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-5';

export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const rd = new FileReader();
  rd.onload = () => resolve(rd.result);
  rd.onerror = () => reject(new Error('Image read nahi ho payi.'));
  rd.readAsDataURL(file);
});

async function callJson(system, userText, imageUrl) {
  const key = import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('VITE_OPENAI_API_KEY set nahi hai (.env file check karo, phir dev server restart karo).');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } }] }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

const SHAPES = {
  consumption: `{
  "date": "string, e.g. 12/05/2025",
  "raw": [{ "name": "string", "opening": number, "received": number, "trans": number, "consumed": number, "kgHeat": number|null }],
  "charge": [{ "name": "string", "opening": number, "outside": number, "inhouse": number, "consumed": number }],
  "summary": { "totalProd": number, "finishProd": number, "totalHeat": number, "mnYield": number, "totalCons": number,
               "loss1Label": "string", "loss1": number, "loss2Label": "string", "loss2": number }
}
Section meanings: "raw" = Raw Material table (alloys/coal): Opening, Received, Trans(fer), Consumed, Kg/Heat.
"charge" = Charge Material table (scrap/pellets): Opening, Received Outside, Received In House, Consumed.
"summary" = Total Production, Finish Production, Total Heat, Mn Yield, Total Consumption, and the two loss lines
(Standard+Lounder loss, Burning loss+Slag) with their labels exactly as printed.`,
  billet: `{
  "title": "string",
  "date": "string",
  "sizes": [{
    "size": "string, e.g. 125 mm (text after the word Size)",
    "items": [{ "name": "string", "opening": number, "production": number, "despatch": number, "transfer": number, "fileClosing": number|null, "remarks": "string" }],
    "fileTotals": { "opening": number, "production": number, "despatch": number, "transfer": number, "closing": number } | null
  }]
}
Each "Size ..." block of the report is one entry in "sizes". "fileTotals" is the printed total row of that block, if any.`
};

const RULES = `Rules: copy numbers exactly as printed (no rounding, no unit conversion, no thousands separators). Use 0 for an empty numeric cell,
null only where the shape allows it. Do not invent rows or calculate anything that is not printed. Keep row order as in the image.
Reply with a single JSON object only.`;

export async function extractFromImage(kind, imageUrl) {
  return callJson(
    `You read photos/scans of Indian steel-plant production reports and extract their tables into JSON. ${RULES}`,
    `Extract the report in this image into exactly this JSON shape:\n${SHAPES[kind]}`,
    imageUrl
  );
}

// Second LLM pass: compares the extracted JSON with the image and returns corrections.
export async function verifyExtraction(kind, imageUrl, extracted) {
  const out = await callJson(
    `You are a strict auditor checking data extracted from an image of a steel-plant report. Compare EVERY value (names, numbers, date, totals)
against the image. Fix only real mismatches (misread digits, swapped columns, missing or extra rows, wrong labels). ${RULES}`,
    `Extracted JSON:\n${JSON.stringify(extracted)}\n\nJSON shape reference:\n${SHAPES[kind]}\n\n` +
    `Reply with: { "issues": [{ "field": "where, e.g. raw[2].consumed", "was": value, "now": value, "reason": "short reason" }], "corrected": <full JSON in the same shape, with all fixes applied> }.\n` +
    `If everything matches the image, reply { "issues": [], "corrected": <the same JSON> }.`,
    imageUrl
  );
  return { issues: Array.isArray(out.issues) ? out.issues : [], corrected: out.corrected || extracted };
}

export async function extractAndVerify(kind, file, onStage = () => {}) {
  const imageUrl = await fileToDataUrl(file);
  onStage('Extracting data from image…');
  const extracted = await extractFromImage(kind, imageUrl);
  onStage('Verifying extracted data with a second pass…');
  let verified;
  try {
    verified = await verifyExtraction(kind, imageUrl, extracted);
  } catch (e) {
    return { data: extracted, issues: [], verifyError: e.message };
  }
  return { data: verified.corrected, issues: verified.issues, verifyError: null };
}

export const formatIssue = i => `${i.field}: ${JSON.stringify(i.was)} → ${JSON.stringify(i.now)}${i.reason ? ` (${i.reason})` : ''}`;
