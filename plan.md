Plan para persistir y reutilizar el JWT en campañas de Ford Mailer
1. Extender el modelo Campaign para almacenar el JWT
Actualizar el esquema en src/models/Campaign.js para agregar un campo opcional jwtToken: String.
Mantener campos existentes (tenantId, userId, segmentId, nombreCampaña, canales, plantillaEmail, estado, lastError) sin cambios.
No usar el jwtToken para nada más que llamadas a vector-rag (no exponerlo en respuestas públicas).
2. Guardar el JWT al crear la campaña
En createCampaignFromRag (src/controllers/campaign.controller.js):
Asegurarse de desestructurar jwtToken desde req.body junto con segmentId, nombreCampaña, etc.
Al crear la campaña con CampaignModel.create, incluir jwtToken como parte del documento (jwtToken: jwtToken).
Mantener el flujo actual: validar segmento en vector-rag ANTES de crear la campaña, luego guardar con estado CREADA y cambiar a ENVIANDO.
3. Reutilizar el JWT en sendCampaignCore para envíos en background
Refactorizar la función sendCampaignCore en src/controllers/campaign.controller.js:
Cambiar la firma a algo como sendCampaignCore({ tenantId, campaignId }) en lugar de recibir el objeto campaña completo.
Dentro de sendCampaignCore, cargar la campaña desde Mongo: const campaign = await CampaignModel.findById(campaignId);.
Extraer segmentId y jwtToken desde campaign.
Construir headers para vector-rag usando el jwtToken almacenado:
Si existe → Authorization: Bearer <jwtToken>.
Si no existe → log de advertencia y llamada sin Authorization (para compatibilidad).
Usar esos headers en axios.get(${VECTOR_RAG_BASE_URL}/api/segments/${segmentId}, { headers }).
Mantener el resto de la lógica (dedupe de emails, construcción de promos, llamada a runFordCampaign).
4. Adaptar los puntos de entrada que llaman a sendCampaignCore
createCampaignFromRag:
Después de crear la campaña y marcarla ENVIANDO, llamar a sendCampaignCore({ tenantId, campaignId: campaign._id }) en background (sin esperar), en lugar de pasar el objeto campaña entero.
sendCampaign (POST /api/campaigns/:campaignId/send):
Tras validar y marcar la campaña ENVIANDO, llamar a sendCampaignCore({ tenantId, campaignId }), reutilizando el jwtToken guardado.
5. Logs y verificación
Añadir logs breves en sendCampaignCore:
Log cuando se encuentra/el no jwtToken en la campaña (preview de los primeros caracteres, nunca el token completo).
Log cuando se llama a vector-rag con/ sin Authorization.
Probar el flujo completo:
Desde vector-rag-app: POST /api/campaigns/start-from-segment → que llame a ford-mailer con jwtToken en el body.
Ver en docker compose logs -f api que:
createCampaignFromRag guarda el jwtToken y crea la campaña.
sendCampaignCore recupera jwtToken desde Mongo y lo usa al llamar a vector-rag.
Ver en docker compose logs -f worker que se procesan jobs y no hay más errores 401 desde vector-rag.