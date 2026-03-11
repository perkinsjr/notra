import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createDb } from "@notra/db/drizzle-http";
import { trimTrailingSlash } from "hono/trailing-slash";
import { authMiddleware } from "./middleware/auth";
import { contentRoutes } from "./routes/content";

interface AppEnv {
  Variables: {
    db: ReturnType<typeof createDb>;
  };
}

const app = new OpenAPIHono<AppEnv>({ strict: true });

app.use(trimTrailingSlash({ alwaysRedirect: true }));

app.use("/v1/*", async (c, next) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return c.json({ error: "DATABASE_URL is not configured" }, 503);
  }
  c.set("db", createDb(databaseUrl));
  await next();
});

app.use("/v1/*", (c, next) =>
  authMiddleware({ permissions: "api.read" })(c, next)
);

app.get("/", (c) => {
  return c.text("ok");
});

app.get("/ping", (c) => {
  return c.text("pong");
});

app.route("/v1", contentRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "API Key",
  description:
    "Send your API key in the Authorization header as Bearer API_KEY.",
});

app.doc31("/openapi.json", (_c) => ({
  openapi: "3.1.1",
  info: {
    title: "Notra API",
    version: "1.0.0",
    description: "OpenAPI schema for authenticated content endpoints.",
  },
  servers: [
    {
      url: "https://api.usenotra.com",
      description: "Production",
    },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    {
      name: "Content",
      description: "Read content for the authenticated organization",
    },
  ],
}));

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API server listening on http://localhost:${info.port}`);
});

export default app;
