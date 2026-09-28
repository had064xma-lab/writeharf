exports.handler = async (event) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "GROQ_API_KEY is not set." }) };
  }

  const isTest = event.httpMethod === "GET";
  if (event.httpMethod !== "POST" && !isTest) {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let userText = "Say hello in one short sentence.";
  let system = null;
  let maxTokens = 1000;

  if (!isTest) {
    let reqBody;
    try {
      reqBody = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: "Invalid JSON body" };
    }
    userText = (reqBody.messages && reqBody.messages[0] && reqBody.messages[0].content) || "";
    system = reqBody.system || null;
    maxTokens = reqBody.max_tokens || 1000;
  }

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: userText });

  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  const errors = [];

  for (const model of models) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: Math.min(Math.max(maxTokens, 1024), 8000),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        errors.push(model + ": " + (data.error?.message || response.status));
        continue;
      }

      const text = data.choices?.[0]?.message?.content || "";
      if (!text) {
        errors.push(model + ": empty response");
        continue;
      }

      if (isTest) {
        return {
          statusCode: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: "OK - model " + model + " replied: " + text,
        };
      }
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ content: [{ type: "text", text }] }),
      };
    } catch (err) {
      errors.push(model + ": " + String(err));
    }
  }

  if (isTest) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: "FAILED:\n" + errors.join("\n"),
    };
  }
  return {
    statusCode: 502,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: errors.join(" | ") }),
  };
};
