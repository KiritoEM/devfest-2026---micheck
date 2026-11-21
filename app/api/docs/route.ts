import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MiCheck API - Swagger UI</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"
    />
    <style>
      body {
        margin: 0;
        background: #fafafa;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        if (!window.SwaggerUIBundle) {
          document.getElementById("swagger-ui").textContent =
            "Swagger UI n'a pas pu être chargé (CDN indisponible). La spec reste disponible sur /api/openapi.";
          return;
        }
        window.SwaggerUIBundle({
          url: "/api/openapi",
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
          displayRequestDuration: true,
          tryItOutEnabled: true,
        });
      };
    </script>
  </body>
</html>`;

export const GET = async () => {
    return new NextResponse(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
    });
};
