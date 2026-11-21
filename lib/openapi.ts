const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const param = (name: string) => ({ $ref: `#/components/parameters/${name}` });

const response = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } },
});

const errorResponse = (description = "Erreur interne du serveur") =>
  response(description, ref("Error"));

const bearer = [{ bearerAuth: [] }];
const nextauth = [{ cookieAuth: [] }];

// Exemples sélectionnables dans Swagger UI (menu « Examples »).
// Les scénarios reprennent PRODUCT_SCOPE.md §5. Les URL de médias sont des
// espaces réservés : le serveur ne les télécharge pas, seules les métadonnées
// sont transmises à l'IA.
const contextDetectorExamples = {
  texte_simple: {
    summary: "Texte collé (forme courte, content = chaîne)",
    value: {
      content:
        "Une nouvelle loi interdit l'utilisation du téléphone portable au volant à l'arrêt dès demain en France.",
    },
  },
  scenario_1_fausse_loi: {
    summary: "Scénario démo 1 — fausse loi virale",
    value: {
      content: {
        type: "text",
        text: "URGENT : à partir de demain, une nouvelle loi interdit de payer en espèces au-delà de 10 € dans tous les commerces en France. Partagez avant que ce soit supprimé !",
      },
      options: { language: "fr" },
    },
  },
  scenario_2_video_recyclee: {
    summary: "Scénario démo 2 — vidéo recyclée présentée comme actuelle",
    value: {
      content: {
        type: "mixed",
        text: "Images filmées ce matin : des inondations ravagent le centre-ville de Valence.",
        media: [
          {
            type: "video",
            url: "https://example.org/video-inondation.mp4",
            name: "video-inondation.mp4",
            mimeType: "video/mp4",
          },
        ],
      },
      options: { language: "fr" },
    },
  },
  scenario_3_image_sans_source: {
    summary: "Scénario démo 3 — image sans source, soupçon d'IA",
    value: {
      content: {
        type: "mixed",
        text: "Photo du pape en doudoune blanche lors d'une sortie à Rome.",
        media: [
          {
            type: "image",
            url: "https://example.org/photo.jpg",
            name: "photo.jpg",
            mimeType: "image/jpeg",
          },
        ],
      },
      options: { language: "fr" },
    },
  },
  url_publication: {
    summary: "Lien vers une publication (l'URL n'est pas téléchargée)",
    value: {
      content: {
        type: "url",
        url: "https://example.org/article-viral",
        text: "Titre partagé : « Le gouvernement supprime le bac en 2027 ».",
      },
      options: { language: "fr" },
    },
  },
  sans_recherche_web: {
    summary: "Test rapide sans recherche web (skipSearch)",
    value: {
      content:
        "La tour Eiffel mesure 330 mètres depuis l'ajout d'une nouvelle antenne en 2022.",
      options: { language: "fr", skipSearch: true, includeReport: true },
    },
  },
  erreur_400_contenu_vide: {
    summary: "Erreur attendue — contenu vide (400)",
    value: { content: "   " },
  },
};

const contextDetectorRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: ref("ContextDetectorRequest"),
      examples: contextDetectorExamples,
    },
  },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "MiCheck API",
    version: "1.0.0",
    description:
      "Documentation des routes Next.js App Router sous `app/api`. Les routes protégées utilisent soit un token `Bearer` (session DB, rôle ADMIN par défaut), soit la session NextAuth via cookie. Les paramètres `pagination_count` et `pagination_skip` ne sont appliqués que s'ils sont tous deux fournis et non nuls.",
  },
  servers: [{ url: "/", description: "Serveur courant" }],
  tags: [
    { name: "docs", description: "Documentation et spécification" },
    { name: "public", description: "Routes publiques" },
    { name: "auth", description: "Authentification et sessions" },
    { name: "products", description: "Produits et catégories" },
    { name: "users", description: "Utilisateurs" },
    { name: "payments", description: "Paiements et transactions" },
    { name: "admin", description: "Administration" },
    { name: "bot", description: "Assistant IA" },
    {
      name: "context-detector",
      description:
        "Bot d'investigation : extraction d'affirmations, recherche de preuves, chronologie, verdicts nuancés et dossier sourcé.",
    },
  ],
  paths: {
    "/api/docs": {
      get: {
        tags: ["docs"],
        operationId: "getSwaggerUi",
        summary: "Interface Swagger UI",
        responses: {
          200: {
            description: "Page HTML Swagger UI",
            content: { "text/html": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/api/openapi": {
      get: {
        tags: ["docs"],
        operationId: "getOpenApiDocument",
        summary: "Spécification OpenAPI 3.0.3",
        responses: {
          200: response("Document OpenAPI", { type: "object" }),
        },
      },
    },
    "/api/category": {
      get: {
        tags: ["public", "products"],
        operationId: "listCategories",
        summary: "Lister les catégories avec leurs produits",
        responses: {
          200: response("Catégories", {
            type: "array",
            items: ref("Category"),
          }),
          500: errorResponse(),
        },
      },
    },
    "/api/product/{cuid}": {
      get: {
        tags: ["public", "products"],
        operationId: "getProductByCuid",
        summary: "Récupérer un produit par son cuid",
        parameters: [
          {
            name: "cuid",
            in: "path",
            required: true,
            description: "Identifiant public du produit",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: response("Produit", ref("Product")),
          404: response("Produit introuvable", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/auth/[...nextauth]": {
      get: {
        tags: ["auth"],
        operationId: "nextAuthGet",
        summary: "Endpoint NextAuth (GET)",
        responses: {
          200: response("Réponse NextAuth", { type: "object" }),
        },
      },
      post: {
        tags: ["auth"],
        operationId: "nextAuthPost",
        summary: "Endpoint NextAuth (POST)",
        responses: {
          200: response("Réponse NextAuth", { type: "object" }),
        },
      },
    },
    "/api/auth/server_session": {
      post: {
        tags: ["auth"],
        operationId: "getServerSessionToken",
        summary: "Récupérer le token de la session serveur",
        responses: {
          200: response("Token de session", ref("ServerSession")),
          500: errorResponse(),
        },
      },
    },
    "/api/verify_recaptcha": {
      post: {
        tags: ["public"],
        operationId: "verifyRecaptcha",
        summary: "Vérifier un token reCAPTCHA",
        description:
          "Le secret reCAPTCHA est lu côté serveur depuis `RECAPTCHA_SITE_SECRET`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("RecaptchaRequest"),
            },
          },
        },
        responses: {
          200: response(
            "Résultat de la vérification",
            ref("RecaptchaResponse"),
          ),
          500: errorResponse(),
        },
      },
    },
    "/api/bot/bot_recommandation": {
      post: {
        tags: ["bot"],
        operationId: "botRecommendation",
        summary:
          "Obtenir une recommandation de l'assistant IA (hérité, non fonctionnel)",
        description:
          "Chatbot hérité de l'ancienne boutique, hors périmètre MiCheck. Non fonctionnel dans ce dépôt : `@langchain/*` n'est pas installé et `@/data/prompt-data` est absent. Utiliser /api/context-detector/* pour le bot de vérification.",
        deprecated: true,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("BotRequest"),
              example: {
                prompt: "Quel produit me conseillez-vous pour un cadeau ?",
              },
            },
          },
        },
        responses: {
          201: response("Réponse de l'assistant", ref("BotResponse")),
          404: response("Prompt ou réponse absent", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/context-detector/skills": {
      get: {
        tags: ["public", "context-detector"],
        operationId: "listContextDetectorSkills",
        summary: "Lister les skills disponibles du détecteur de contexte",
        description:
          "Chaque skill correspond à une étape du pipeline : extraction, recherche, évaluation des sources, contradiction, chronologie, verdicts et dossier. Les skills qui nécessitent un outil ne sont actifs que si cet outil est configuré côté serveur.",
        responses: {
          200: response(
            "Skills disponibles",
            ref("ContextDetectorSkillsResponse"),
          ),
        },
      },
    },
    "/api/context-detector/claims": {
      post: {
        tags: ["public", "context-detector"],
        operationId: "extractContextDetectorClaims",
        summary: "Décomposer un contenu en affirmations vérifiables",
        description:
          "Première étape du pipeline : ne produit ni preuve ni verdict (1 appel IA, aucune recherche web). Nécessite au moins une clé IA (Groq, xAI, Mistral, Gemini ou Hugging Face) ; les fournisseurs sont essayés dans l'ordre de CONTEXT_DETECTOR_AI_PROVIDERS, puis tout autre fournisseur doté d'une clé. Le résultat n'est pas stocké.",
        requestBody: contextDetectorRequestBody,
        responses: {
          200: response(
            "Affirmations extraites",
            ref("ContextDetectorClaimsResponse"),
          ),
          400: response("Contenu invalide", ref("Message")),
          502: errorResponse("Fournisseur IA indisponible"),
          503: errorResponse("IA non configurée"),
          500: errorResponse(),
        },
      },
    },
    "/api/context-detector/investigate": {
      post: {
        tags: ["public", "context-detector"],
        operationId: "runContextDetectorInvestigation",
        summary:
          "Lancer une investigation complète et produire un dossier sourcé",
        description:
          "Pipeline : extraction des affirmations > plan de recherche > recherche web (si configurée : Tavily, avec repli Brave ou générique selon CONTEXT_DETECTOR_SEARCH_PROVIDERS) > évaluation des sources, contradictions et chronologie > verdicts nuancés > dossier Markdown. Les images envoyées en dataUrl et les images clés vidéo (frames) sont analysées par un modèle vision si configuré ; l'inspection visuelle ne certifie jamais l'authenticité. Les fournisseurs IA (Groq, xAI, Mistral, Gemini, Hugging Face) sont essayés dans l'ordre de CONTEXT_DETECTOR_AI_PROVIDERS, puis tout autre fournisseur doté d'une clé. 2 appels IA + recherche web : compter 10 à 60 s. L'URL, le titre, l'éditeur, l'extrait et les dates de chaque preuve proviennent exclusivement des résultats de recherche réellement récupérés, jamais de l'IA. Un verdict `confirmed`, `refuted`, `partially_confirmed` ou `misleading_or_out_of_context` sans preuve citée est ramené côté serveur à `unverifiable` (confiance `low`). Les URL et médias soumis ne sont pas téléchargés. Le dossier est conservé 30 min en mémoire.",
        requestBody: contextDetectorRequestBody,
        responses: {
          201: response(
            "Dossier de vérification",
            ref("ContextDetectorInvestigationResponse"),
          ),
          400: response("Contenu invalide", ref("Message")),
          502: errorResponse("Fournisseur IA indisponible"),
          503: errorResponse("IA non configurée"),
          500: errorResponse(),
        },
      },
    },
    "/api/context-detector/investigations/{id}": {
      get: {
        tags: ["public", "context-detector"],
        operationId: "getContextDetectorInvestigation",
        summary: "Récupérer un dossier par son identifiant",
        description:
          "Les dossiers sont conservés en mémoire pendant 30 minutes dans cette implémentation.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description:
              "Identifiant `investigation_id` retourné par POST /api/context-detector/investigate (perdu après 30 min ou au redémarrage du serveur)",
            schema: { type: "string", format: "uuid" },
            example: "3f2b8c1e-7a4d-4e9b-9c55-1d2e3f4a5b6c",
          },
        ],
        responses: {
          200: response(
            "Dossier de vérification",
            ref("ContextDetectorInvestigationResponse"),
          ),
          404: response("Investigation introuvable", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/context-detector/chat": {
      post: {
        tags: ["public", "context-detector"],
        operationId: "chatWithContextDetector",
        summary: "Discuter avec l'assistant de vérification",
        description:
          "Assistant conversationnel. Sans investigation_id, il explique la méthode de vérification sans prétendre avoir vérifié un contenu. Avec investigation_id, il s'appuie sur le dossier stocké (30 min), cite ses sources [S1] et ne fabrique jamais d'URL. Cette route ne lance aucune recherche web et ne certifie jamais l'authenticité d'une image.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("ContextDetectorChatRequest"),
              example: {
                messages: [
                  {
                    role: "user",
                    content: "Résume ce dossier en trois lignes.",
                  },
                ],
                investigation_id: "3f2b8c1e-7a4d-4e9b-9c55-1d2e3f4a5b6c",
                language: "fr",
              },
            },
          },
        },
        responses: {
          200: {
            description: "Signaux techniques de l'image",
            content: {
              "application/json": {
                schema: ref("MediaSignalsResponse"),
                examples: {
                  photo_avec_exif: {
                    summary: "Photo d'appareil avec EXIF et GPS",
                    value: {
                      file_name: "photo.jpg",
                      size_bytes: 2483112,
                      mime_type_declared: "image/jpeg",
                      mime_type_detected: "image/jpeg",
                      width: 4032,
                      height: 3024,
                      exif: {
                        make: "Nikon",
                        model: "D750",
                        date_time_original: "2021:03:14 09:26:53",
                        gps_present: true,
                      },
                      provenance_markers: [],
                      signals: [
                        {
                          code: "camera_declared",
                          category: "metadata",
                          message:
                            "Appareil déclaré dans l'EXIF : Nikon D750. Ces champs peuvent être modifiés.",
                        },
                        {
                          code: "capture_date_declared",
                          category: "metadata",
                          message:
                            "Date de prise de vue déclarée : 2021:03:14 09:26:53 (horloge de l'appareil, modifiable). À comparer avec la date de l'événement allégué.",
                        },
                        {
                          code: "gps_present",
                          category: "privacy",
                          message:
                            "Le fichier contient des coordonnées GPS. Elles ne sont pas renvoyées par MiCheck pour protéger la vie privée ; évitez de partager l'original.",
                        },
                      ],
                      analyzed_at: "2026-11-21T10:00:00.000Z",
                      disclaimer:
                        "Ces signaux ne prouvent pas l'authenticité : ce sont des indices à croiser avec une vérification des sources. MiCheck ne détecte pas les deepfakes ni les images générées par IA de manière fiable.",
                    },
                  },
                  image_reseau_social: {
                    summary:
                      "Image recompressée sans métadonnées (cas le plus courant)",
                    value: {
                      file_name: "capture.webp",
                      size_bytes: 84211,
                      mime_type_declared: "image/webp",
                      mime_type_detected: "image/webp",
                      width: 1080,
                      height: 1350,
                      exif: null,
                      provenance_markers: [],
                      signals: [
                        {
                          code: "no_exif",
                          category: "metadata",
                          message:
                            "Aucune métadonnée EXIF. C'est courant pour les images partagées sur les réseaux sociaux ou les messageries, qui les suppriment : cela ne prouve rien dans un sens ni dans l'autre.",
                        },
                      ],
                      analyzed_at: "2026-11-21T10:00:00.000Z",
                      disclaimer:
                        "Ces signaux ne prouvent pas l'authenticité : ce sont des indices à croiser avec une vérification des sources. MiCheck ne détecte pas les deepfakes ni les images générées par IA de manière fiable.",
                    },
                  },
                },
              },
            },
          },
          400: response(
            "Requête invalide : multipart illisible, champ `file` absent ou texte, plusieurs fichiers, fichier vide",
            ref("MediaSignalsError"),
          ),
          413: response("Fichier de plus de 4 Mo", ref("MediaSignalsError")),
          415: response(
            "Corps non multipart, ou format réel autre que JPEG, PNG ou WebP",
            ref("MediaSignalsError"),
          ),
          422: response(
            "Image tronquée ou endommagée : dimensions illisibles",
            ref("MediaSignalsError"),
          ),
          500: errorResponse(),
        },
      },
    },
    "/api/products": {
      get: {
        tags: ["public", "products"],
        operationId: "listProducts",
        summary: "Lister les produits avec filtres et pagination",
        parameters: [
          param("PaginationCount"),
          param("PaginationSkip"),
          param("CategoryId"),
          param("PriceRange"),
          param("SearchValue"),
        ],
        responses: {
          200: response("Produits paginés", ref("PaginatedProducts")),
          500: errorResponse(),
        },
      },
    },
    "/api/products/count": {
      get: {
        tags: ["products"],
        operationId: "countProducts",
        summary: "Compter les produits (ADMIN)",
        security: bearer,
        responses: {
          200: response("Nombre de produits", ref("Count")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/products/recent": {
      get: {
        tags: ["products"],
        operationId: "recentProducts",
        summary: "Produits des 7 derniers jours (ADMIN)",
        security: bearer,
        responses: {
          200: response("Produits récents", ref("RecentProducts")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["users"],
        operationId: "listUsers",
        summary: "Lister les utilisateurs avec pagination (ADMIN)",
        security: bearer,
        parameters: [param("PaginationCount"), param("PaginationSkip")],
        responses: {
          200: response("Utilisateurs paginés", ref("PaginatedUsers")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/users/count": {
      get: {
        tags: ["users"],
        operationId: "countUsers",
        summary: "Compter les utilisateurs (ADMIN)",
        security: bearer,
        responses: {
          200: response("Nombre d'utilisateurs", ref("Count")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/users/get_stats": {
      get: {
        tags: ["users"],
        operationId: "getUserStats",
        summary: "Statistiques d'inscription par mois (ADMIN)",
        security: bearer,
        parameters: [param("Year")],
        responses: {
          200: response("Statistiques", ref("StatsResponse")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/user": {
      get: {
        tags: ["users", "auth"],
        operationId: "getCurrentUser",
        summary: "Récupérer l'utilisateur de la session NextAuth",
        security: nextauth,
        responses: {
          200: response("Utilisateur courant", ref("UserResponse")),
          401: errorResponse("Non autorisé"),
          404: response("Utilisateur introuvable", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/payment": {
      post: {
        tags: ["payments"],
        operationId: "createCheckoutSession",
        summary: "Créer une session de paiement Stripe",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: ref("CheckoutRequest") },
          },
        },
        responses: {
          200: response("Session Stripe", ref("CheckoutSession")),
          400: response("Produits manquants", ref("Message")),
          500: errorResponse(),
        },
      },
      get: {
        tags: ["payments"],
        operationId: "listPayments",
        summary: "Lister les transactions avec pagination (ADMIN)",
        security: bearer,
        parameters: [param("PaginationCount"), param("PaginationSkip")],
        responses: {
          200: response("Transactions paginées", ref("PaginatedTransactions")),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/payment/count": {
      get: {
        tags: ["payments"],
        operationId: "countPayments",
        summary: "Compter les transactions d'une année (ADMIN)",
        security: bearer,
        parameters: [param("YearRequired")],
        responses: {
          200: response("Nombre de transactions", ref("Count")),
          401: errorResponse("Non autorisé"),
          404: response("Année manquante", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/payment/get_stats": {
      get: {
        tags: ["payments"],
        operationId: "getPaymentStats",
        summary: "Statistiques de paiement par mois (ADMIN)",
        security: bearer,
        parameters: [param("YearRequired")],
        responses: {
          200: response("Statistiques", ref("StatsResponse")),
          401: errorResponse("Non autorisé"),
          404: response("Année manquante", ref("Message")),
          500: errorResponse(),
        },
      },
    },
    "/api/admin/info": {
      get: {
        tags: ["admin"],
        operationId: "getAdminInfo",
        summary: "Lister les informations administrateur (ADMIN)",
        security: bearer,
        responses: {
          200: response("Administrateurs", {
            type: "array",
            items: ref("AdminInfo"),
          }),
          401: errorResponse("Non autorisé"),
          500: errorResponse(),
        },
      },
    },
    "/api/admin/session/{token}": {
      get: {
        tags: ["admin", "auth"],
        operationId: "getAdminSession",
        summary: "Récupérer une session DB par son token",
        description:
          "Le token sensible est transmis dans le chemin : à utiliser uniquement en interne.",
        parameters: [
          {
            name: "token",
            in: "path",
            required: true,
            description: "Token de session DB",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: response("Session", ref("Session")),
          404: response("Session introuvable", ref("Message")),
          500: errorResponse(),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "DB session token",
        description:
          "Token de session DB transmis dans `Authorization: Bearer <token>`. Rôle ADMIN par défaut, SUPERADMIN sur certaines routes.",
      },
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "next-auth.session-token",
        description:
          "Cookie NextAuth (`__Secure-next-auth.session-token` en production).",
      },
    },
    parameters: {
      PaginationCount: {
        name: "pagination_count",
        in: "query",
        required: false,
        description: "Nombre d'éléments à retourner",
        schema: { type: "integer", minimum: 1 },
      },
      PaginationSkip: {
        name: "pagination_skip",
        in: "query",
        required: false,
        description: "Nombre d'éléments à ignorer",
        schema: { type: "integer", minimum: 0 },
      },
      CategoryId: {
        name: "category_id",
        in: "query",
        required: false,
        description: "Filtrer par catégorie",
        schema: { type: "integer" },
      },
      PriceRange: {
        name: "price_range",
        in: "query",
        required: false,
        description: "Intervalle de prix au format `min-max`",
        schema: { type: "string", example: "10-100" },
      },
      SearchValue: {
        name: "search_value",
        in: "query",
        required: false,
        description: "Recherche insensible à la casse sur le nom",
        schema: { type: "string" },
      },
      Year: {
        name: "year",
        in: "query",
        required: false,
        description: "Année des statistiques",
        schema: { type: "integer", example: 2026 },
      },
      YearRequired: {
        name: "year",
        in: "query",
        required: true,
        description: "Année des statistiques",
        schema: { type: "integer", example: 2026 },
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          error: { type: "string", nullable: true },
        },
      },
      Message: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      Count: {
        type: "object",
        required: ["count"],
        properties: { count: { type: "integer" } },
      },
      Stats: {
        type: "object",
        required: ["month", "count"],
        properties: {
          month: { type: "integer" },
          count: { type: "integer" },
        },
      },
      StatsResponse: {
        type: "object",
        required: ["stats"],
        properties: {
          stats: { type: "array", items: ref("Stats") },
        },
      },
      Product: {
        type: "object",
        required: ["id", "cuid", "name", "price", "category"],
        properties: {
          id: { type: "integer" },
          cuid: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          modelPath: { type: "string" },
          groundColor: { type: "string" },
          config3D: { type: "object" },
          customisationConfigs: { type: "object" },
          category: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Category: {
        type: "object",
        required: ["id", "name", "products"],
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          products: { type: "array", items: ref("Product") },
        },
      },
      PaginatedProducts: {
        type: "object",
        required: ["paginatedData", "totalCount"],
        properties: {
          paginatedData: { type: "array", items: ref("Product") },
          totalCount: { type: "integer" },
        },
      },
      RecentProducts: {
        type: "object",
        required: ["mostSelledProducts"],
        properties: {
          mostSelledProducts: { type: "array", items: ref("Product") },
        },
      },
      Account: {
        type: "object",
        properties: {
          type: { type: "string" },
          provider: { type: "string" },
          providerAccountId: { type: "string" },
          expires_at: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      User: {
        type: "object",
        required: ["id", "email", "name"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          image: { type: "string", nullable: true },
          emailVerified: { type: "string", nullable: true },
          accounts: { type: "array", items: ref("Account") },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaginatedUsers: {
        type: "object",
        required: ["paginatedData", "totalCount"],
        properties: {
          paginatedData: { type: "array", items: ref("User") },
          totalCount: { type: "integer" },
        },
      },
      UserResponse: {
        type: "object",
        required: ["message", "user"],
        properties: {
          message: { type: "string" },
          user: ref("User"),
        },
      },
      Transaction: {
        type: "object",
        required: ["id", "amount", "currency", "status"],
        properties: {
          id: { type: "integer" },
          amount: { type: "number" },
          currency: { type: "string", enum: ["eur"] },
          status: { type: "string" },
          customerEmail: { type: "string" },
          customerName: { type: "string" },
          userId: { type: "string" },
          user: ref("User"),
          stripePaymentIntentId: { type: "string", nullable: true },
          stripeChargeId: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaginatedTransactions: {
        type: "object",
        required: ["paginatedData", "totalCount"],
        properties: {
          paginatedData: { type: "array", items: ref("Transaction") },
          totalCount: { type: "integer" },
        },
      },
      CheckoutRequest: {
        type: "object",
        required: ["products"],
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "integer" },
                image: { type: "string" },
              },
            },
          },
        },
      },
      CheckoutSession: {
        type: "object",
        required: ["id", "client_secret"],
        properties: {
          id: { type: "string" },
          client_secret: { type: "string" },
        },
      },
      RecaptchaRequest: {
        type: "object",
        required: ["captchaValue"],
        properties: { captchaValue: { type: "string" } },
      },
      RecaptchaResponse: {
        type: "object",
        required: ["data"],
        properties: { data: { type: "object" } },
      },
      BotRequest: {
        type: "object",
        required: ["prompt"],
        properties: { prompt: { type: "string" } },
      },
      BotResponse: {
        type: "object",
        required: ["message"],
        properties: { message: { type: "string" } },
      },
      ServerSession: {
        type: "object",
        required: ["accessToken"],
        properties: {
          accessToken: { type: "object", nullable: true },
        },
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string" },
          adminId: { type: "string" },
          token: { type: "string" },
          method: { type: "string" },
          isActive: { type: "boolean" },
          deviceInfo: { type: "string", nullable: true },
          ipAddress: { type: "string", nullable: true },
          userAgent: { type: "string", nullable: true },
          expiresAt: { type: "string", nullable: true },
          expires: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AdminInfo: {
        type: "object",
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          role: { type: "string" },
          adminFacial: { type: "object", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ContextDetectorMediaInput: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["image", "video", "document"] },
          url: { type: "string", format: "uri" },
          dataUrl: {
            type: "string",
            description:
              "Image JPEG, PNG ou WebP en base64 (4 Mo max), analysée par un modèle vision si configuré",
          },
          frames: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
            description:
              "Images clés d'une vidéo fournies par le client (4 max), analysées par le modèle vision",
          },
          name: { type: "string" },
          mimeType: { type: "string" },
        },
      },
      ContextDetectorRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: {
            oneOf: [
              { type: "string", description: "Texte ou publication collée" },
              {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "text",
                      "url",
                      "image",
                      "video",
                      "document",
                      "mixed",
                    ],
                  },
                  text: { type: "string" },
                  url: { type: "string", format: "uri" },
                  media: {
                    type: "array",
                    items: ref("ContextDetectorMediaInput"),
                  },
                },
              },
            ],
          },
          options: {
            type: "object",
            properties: {
              language: { type: "string", example: "fr" },
              skills: {
                type: "array",
                items: { type: "string" },
                description: "Identifiants des skills à exécuter",
              },
              investigationDate: { type: "string", format: "date-time" },
              includeReport: { type: "boolean", default: true },
              skipSearch: { type: "boolean", default: false },
            },
          },
        },
      },
      ContextDetectorSkill: {
        type: "object",
        required: [
          "id",
          "name",
          "description",
          "trigger",
          "outputKey",
          "phase",
          "inputTypes",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          trigger: { type: "string" },
          outputKey: { type: "string" },
          phase: {
            type: "string",
            enum: ["preparation", "investigation", "analysis", "reporting"],
          },
          inputTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["text", "url", "image", "video", "document", "mixed"],
            },
          },
          requiresTool: { type: "string", nullable: true },
        },
      },
      ContextDetectorSkillsResponse: {
        type: "object",
        required: ["count", "skills", "note"],
        properties: {
          count: { type: "integer" },
          skills: { type: "array", items: ref("ContextDetectorSkill") },
          note: { type: "string" },
        },
      },
      ContextDetectorClaim: {
        type: "object",
        required: [
          "id",
          "claim_text",
          "claim_type",
          "importance",
          "checkability",
        ],
        properties: {
          id: { type: "string", example: "C1" },
          claim_text: { type: "string" },
          claim_type: {
            type: "string",
            enum: [
              "event",
              "policy_legal",
              "statistic",
              "quote",
              "identity_allegation",
              "science_health",
              "causal",
              "historical",
              "other",
            ],
          },
          importance: { type: "string", enum: ["high", "medium", "low"] },
          entities: { type: "array", items: { type: "string" } },
          date_or_period: { type: "string" },
          location: { type: "string" },
          verification_question: { type: "string" },
          ambiguities: { type: "array", items: { type: "string" } },
          checkability: {
            type: "string",
            enum: [
              "verifiable",
              "partially_verifiable",
              "not_verifiable",
              "opinion_or_prediction",
            ],
          },
        },
      },
      ContextDetectorClaimsResponse: {
        type: "object",
        required: [
          "input_type",
          "input_summary",
          "language",
          "investigation_date",
          "claims",
        ],
        properties: {
          input_type: {
            type: "string",
            enum: ["text", "url", "image", "video", "document", "mixed"],
          },
          input_summary: { type: "string" },
          language: { type: "string" },
          investigation_date: { type: "string", format: "date-time" },
          claims: { type: "array", items: ref("ContextDetectorClaim") },
        },
      },
      ContextDetectorEvidence: {
        type: "object",
        required: [
          "source_id",
          "claim_ids",
          "url",
          "title",
          "accessed_date",
          "excerpt",
        ],
        properties: {
          source_id: { type: "string", example: "S1" },
          claim_ids: { type: "array", items: { type: "string" } },
          url: { type: "string", format: "uri" },
          title: { type: "string" },
          publisher: { type: "string" },
          published_date: { type: "string" },
          accessed_date: { type: "string", format: "date-time" },
          source_type: { type: "string" },
          excerpt: { type: "string" },
          stance: {
            type: "string",
            enum: ["supports", "contradicts", "contextualizes", "neutral"],
          },
          relevance: { type: "string", enum: ["high", "medium", "low"] },
          retrieval_notes: { type: "string" },
        },
      },
      ContextDetectorVerdict: {
        type: "object",
        required: ["label", "summary", "confidence", "confidence_rationale"],
        properties: {
          label: {
            type: "string",
            enum: [
              "confirmed",
              "refuted",
              "misleading_or_out_of_context",
              "unverifiable",
              "partially_confirmed",
              "opinion_or_non_factual",
            ],
          },
          summary: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          confidence_rationale: { type: "string" },
          key_evidence_ids: { type: "array", items: { type: "string" } },
          limitations: { type: "array", items: { type: "string" } },
        },
      },
      ContextDetectorDossier: {
        type: "object",
        required: [
          "investigation_id",
          "input_type",
          "investigation_date",
          "skills_used",
          "claims",
          "claim_verdicts",
          "overall_verdict",
          "sources",
        ],
        properties: {
          investigation_id: { type: "string", format: "uuid" },
          input_summary: { type: "string" },
          input_type: {
            type: "string",
            enum: ["text", "url", "image", "video", "document", "mixed"],
          },
          language: { type: "string" },
          investigation_date: { type: "string", format: "date-time" },
          skills_used: { type: "array", items: { type: "string" } },
          claims: { type: "array", items: ref("ContextDetectorClaim") },
          evidence: { type: "array", items: ref("ContextDetectorEvidence") },
          claim_verdicts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                claim_id: { type: "string" },
                verdict: {
                  type: "string",
                  enum: [
                    "confirmed",
                    "refuted",
                    "misleading_or_out_of_context",
                    "unverifiable",
                    "partially_confirmed",
                    "opinion_or_non_factual",
                  ],
                },
                explanation: { type: "string" },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                evidence_ids: { type: "array", items: { type: "string" } },
                limitations: { type: "array", items: { type: "string" } },
              },
            },
          },
          overall_verdict: ref("ContextDetectorVerdict"),
          sources: {
            type: "array",
            items: {
              type: "object",
              required: ["source_id", "url", "title", "accessed_date"],
              properties: {
                source_id: { type: "string" },
                url: { type: "string", format: "uri" },
                title: { type: "string" },
                publisher: { type: "string" },
                published_date: { type: "string" },
                accessed_date: { type: "string", format: "date-time" },
              },
            },
          },
          practical_takeaway: { type: "string" },
          limitations: { type: "array", items: { type: "string" } },
        },
        description:
          "Les champs optionnels (search_plan, source_assessments, contradictions, timeline, context_findings, media_findings, video_findings, quote_findings, framing_findings, evidence_gaps) sont présents uniquement lorsque le skill correspondant a été exécuté.",
      },
      ContextDetectorInvestigationResponse: {
        type: "object",
        required: ["investigation_id", "dossier"],
        properties: {
          investigation_id: { type: "string", format: "uuid" },
          dossier: ref("ContextDetectorDossier"),
          report: {
            type: "string",
            description: "Dossier Markdown prêt à afficher",
          },
        },
      },
      MediaSignalsRequest: {
        type: "object",
        required: ["file"],
        properties: {
          file: {
            type: "string",
            format: "binary",
            description: "Une image JPEG, PNG ou WebP de 4 Mo maximum",
          },
        },
      },
      MediaSignal: {
        type: "object",
        required: ["code", "category", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "mime_mismatch",
              "extension_mismatch",
              "low_resolution",
              "exif_unreadable",
              "no_exif",
              "camera_declared",
              "capture_date_declared",
              "software_declared",
              "gps_present",
              "c2pa_manifest",
              "iptc_ai_source_declared",
              "generation_parameters",
            ],
          },
          category: {
            type: "string",
            enum: ["format", "metadata", "provenance", "privacy"],
          },
          message: {
            type: "string",
            description: "Explication en français, formulée comme un indice",
          },
        },
      },
      MediaExifSummary: {
        type: "object",
        required: ["gps_present"],
        properties: {
          make: { type: "string" },
          model: { type: "string" },
          software: { type: "string" },
          date_time_original: {
            type: "string",
            description: "Format EXIF `AAAA:MM:JJ HH:MM:SS`",
          },
          date_time_modified: {
            type: "string",
            description: "Format EXIF `AAAA:MM:JJ HH:MM:SS`",
          },
          gps_present: {
            type: "boolean",
            description:
              "Présence de coordonnées GPS. Les coordonnées ne sont jamais renvoyées.",
          },
        },
      },
      MediaSignalsResponse: {
        type: "object",
        required: [
          "file_name",
          "size_bytes",
          "mime_type_declared",
          "mime_type_detected",
          "width",
          "height",
          "exif",
          "provenance_markers",
          "signals",
          "analyzed_at",
          "disclaimer",
        ],
        properties: {
          file_name: { type: "string" },
          size_bytes: { type: "integer", maximum: 4194304 },
          mime_type_declared: {
            type: "string",
            nullable: true,
            description: "Type annoncé par le client (non fiable)",
          },
          mime_type_detected: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp"],
            description: "Type réel déterminé à partir des octets du fichier",
          },
          width: { type: "integer" },
          height: { type: "integer" },
          exif: { ...ref("MediaExifSummary"), nullable: true },
          provenance_markers: {
            type: "array",
            items: {
              type: "string",
              enum: ["c2pa", "iptc_ai_source", "generation_parameters"],
            },
            description:
              "Marqueurs déclaratifs trouvés dans le fichier, non vérifiés",
          },
          signals: { type: "array", items: ref("MediaSignal") },
          analyzed_at: { type: "string", format: "date-time" },
          disclaimer: { type: "string" },
        },
      },
      MediaSignalsError: {
        type: "object",
        required: ["message", "code"],
        properties: {
          message: { type: "string" },
          code: {
            type: "string",
            enum: [
              "MULTIPART_REQUIRED",
              "INVALID_MULTIPART",
              "FILE_REQUIRED",
              "TOO_MANY_FILES",
              "EMPTY_FILE",
              "FILE_TOO_LARGE",
              "UNSUPPORTED_MEDIA_TYPE",
              "UNREADABLE_IMAGE",
            ],
          },
        },
      },
    },
  },
};
