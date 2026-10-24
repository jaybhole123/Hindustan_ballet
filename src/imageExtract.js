const API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = import.meta.env.OCR_MODEL || import.meta.env.VITE_OCR_MODEL || import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o';
const VERIFY_MODEL = import.meta.env.OCR_VERIFY_MODEL || import.meta.env.VITE_OCR_VERIFY_MODEL || MODEL;

// Optimize image before uploading to keep crisp clarity for small numbers while keeping payload reasonable
export const fileToDataUrl = file => new Promise((resolve, reject) => {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 2500; // High resolution so small table digits and decimals are clearly readable
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.94));
    };
    img.onerror = () => resolve(rd.result);
    img.src = rd.result;
  };
  rd.onerror = () => reject(new Error('Image read nahi ho payi.'));
  rd.readAsDataURL(file);
});

async function callJson(system, userText, imageUrl, model = MODEL) {
  const key = import.meta.env.OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY set nahi hai (.env file check karo, phir dev server restart karo).');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
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
    "size": "string, e.g. 110 x 110 mm or 125 x 125 mm (exact size header as printed)",
    "items": [{
      "name": "string (exact item name, e.g. Tested Billets(6mtr))",
      "opening": number,
      "production": number,
      "despatch": number,
      "transfer": number,
      "returnBillet": number,
      "fileClosing": number,
      "remarks": "string"
    }],
    "fileTotals": { "opening": number, "production": number, "despatch": number, "transfer": number, "returnBillet": number, "closing": number } | null
  }]
}
For Billet Report:
- The standard columns from left to right are: Item Name | Opening | Production | Despatch | Transfer | Return Billet (if printed, else 0) | Closing (or Stock) | Remarks.
- Ensure values are assigned to the correct column: Opening is 1st numeric column, Production 2nd, Despatch 3rd, Transfer 4th, Return Billet is 5th numeric column (0 if not present), Closing is the stock/closing numeric column (fileClosing).
- Notice that in steel plants: Closing = Opening + Production + Return Billet - Despatch - Transfer. Use this arithmetic to verify you did not swap columns.
- Copy decimal numbers with exact 3-decimal precision as printed (e.g. 25.260, 3.742, 175.140).`
};

const RULES = `Rules:
1. Copy numbers exactly as printed (no rounding, no thousands separators). Use 0 for an empty numeric cell, null only where the shape explicitly allows it.
2. Read the image carefully at full resolution. Double-check digits like 6 vs 8, 3 vs 5, 0 vs 8, 1 vs 7.
3. Keep row order and size sections exactly as shown in the image.
4. Reply with a single valid JSON object only.`;

export async function extractFromImage(kind, imageUrl) {
  return callJson(
    `You are an expert OCR & document analysis system specializing in Indian steel-plant daily production reports. Read every column and cell with 100% precision. ${RULES}`,
    `Extract the report in this image into exactly this JSON shape:\n${SHAPES[kind]}`,
    imageUrl
  );
}

// Second LLM pass (optional/verifier): compares the extracted JSON with the image and returns corrections.
export async function verifyExtraction(kind, imageUrl, extracted) {
  const out = await callJson(
    `You are a strict auditor checking data extracted from an image of a steel-plant report. Compare EVERY value (names, numbers, date, totals)
against the image. Fix only real mismatches (misread digits, swapped columns, missing or extra rows, wrong labels). ${RULES}`,
    `Extracted JSON:\n${JSON.stringify(extracted)}\n\nJSON shape reference:\n${SHAPES[kind]}\n\n` +
    `Reply with: { "issues": [{ "field": "where, e.g. raw[2].consumed", "was": value, "now": value, "reason": "short reason" }], "corrected": <full JSON in the same shape, with all fixes applied> }.\n` +
    `If everything matches the image, reply { "issues": [], "corrected": <the same JSON> }.`,
    imageUrl,
    VERIFY_MODEL
  );
  return { issues: Array.isArray(out.issues) ? out.issues : [], corrected: out.corrected || extracted };
}

export async function extractAndVerify(kind, file, onStage = () => {}) {
  onStage('Preparing and reading image…');
  const imageUrl = await fileToDataUrl(file);
  onStage('Extracting data from image…');
  const extracted = await extractFromImage(kind, imageUrl);
  return { data: extracted, issues: [], verifyError: null, imageUrl };
}

export const formatIssue = i => `${i.field}: ${JSON.stringify(i.was)} → ${JSON.stringify(i.now)}${i.reason ? ` (${i.reason})` : ''}`;

