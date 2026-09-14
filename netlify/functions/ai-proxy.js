// Netlify Function: proxies requests to Google's Gemini API (FREE tier,
// no credit card required) so the app's site code needs zero changes.
//
// The client always sends/expects Anthropic-shaped JSON:
//   request:  { model, max_tokens, system, messages: [{role:"user", content}] }
//   response: { content: [{ type: "text", text: "..." }] }
// This function translates that to/from Gemini's own API shape internally.
//
// Setup on Netlify:
//   1. Get a free key at https://aistudio.google.com/apikey (Google account only, no billing).
//   2. Site settings -> Environment variables -> add GEMINI_API_KEY
//   3. Deploy.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "GEMINI_API_KEY is not set in this site's environment variables.",
      }),
    };
  }

  let reqBody;
  try {
    reqBody = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const geminiModel = "gemini-2.5-flash"; // free tier, generous daily quota
  const userText =
    (reqBody.messages && reqBody.messages[0] && reqBody.messages[0].content) || "";

  const geminiBody = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: {
      maxOutputTokens: reqBody.max_tokens || 1000,
    },
  };
  if (reqBody.system) {
    geminiBody.systemInstruction = { parts: [{ text: reqBody.system }] };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error?.message || "Gemini API error" }),
      };
    }

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Reshape into the Anthropic-style response the client already expects.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
