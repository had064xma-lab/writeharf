// Netlify Function: per-user cloud storage for WriteHarf.
// Requires Netlify Identity to be enabled on the site (Site settings -> Identity).
// The client must send `Authorization: Bearer <identity JWT>` — when it does,
// Netlify automatically populates `context.clientContext.user` for us.

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;

  if (!user) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Not authenticated. Please log in." }),
    };
  }

  const store = getStore("writeharf-users");
  const key = user.sub; // stable unique id for this Identity user

  try {
    if (event.httpMethod === "GET") {
      const data = await store.get(key, { type: "json" });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
      };
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return { statusCode: 400, body: "Invalid JSON body" };
      }
      await store.setJSON(key, body);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
