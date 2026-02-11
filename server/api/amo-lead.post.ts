type AmoLeadPayload = {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  comment?: string;
  message?: string;
  company?: string;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

type AmoLead = { id?: number };
type AmoComplexResponse = AmoLead[] | { _embedded?: { leads?: AmoLead[] } };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitStore = new Map<string, RateLimitState>();

const trimValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeBaseUrl = (value: unknown) => {
  const url = trimValue(value);
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const toPositiveIntOrNull = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getNoteText = (city: string, comment: string, message: string) => {
  if (city || comment) {
    return [city ? `City: ${city}` : '', comment].filter(Boolean).join('\n');
  }
  return message;
};

const hitRateLimit = (ip: string) => {
  const now = Date.now();
  const current = rateLimitStore.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(ip, current);
  return false;
};

const extractLeadId = (data: AmoComplexResponse) => {
  if (Array.isArray(data)) {
    return data[0]?.id ?? null;
  }
  return data?._embedded?.leads?.[0]?.id ?? null;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as AmoLeadPayload | null;
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    });
  }

  const name = trimValue(body.name);
  const phone = trimValue(body.phone);
  const email = trimValue(body.email);
  const city = trimValue(body.city);
  const comment = trimValue(body.comment);
  const message = trimValue(body.message);
  const company = trimValue(body.company);

  if (company) {
    return { ok: true };
  }

  if (!phone && !email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Phone or email is required',
    });
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  if (hitRateLimit(ip)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
    });
  }

  const config = useRuntimeConfig(event);
  const amoBaseUrl = normalizeBaseUrl(config.amoBaseUrl);
  const amoAccessToken = trimValue(config.amoAccessToken);
  const leadCityFieldId = toPositiveIntOrNull(config.amoLeadCityFieldId);
  const leadCommentFieldId = toPositiveIntOrNull(config.amoLeadCommentFieldId);

  if (!amoBaseUrl || !amoAccessToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'amoCRM is not configured',
    });
  }

  const identity = name || phone || email;
  const contactFields = [];
  if (phone) {
    contactFields.push({ field_code: 'PHONE', values: [{ value: phone }] });
  }
  if (email) {
    contactFields.push({ field_code: 'EMAIL', values: [{ value: email }] });
  }

  const leadCustomFields = [];
  if (leadCityFieldId && city) {
    leadCustomFields.push({ field_id: leadCityFieldId, values: [{ value: city }] });
  }
  if (leadCommentFieldId && comment) {
    leadCustomFields.push({ field_id: leadCommentFieldId, values: [{ value: comment }] });
  }

  const leadPayload = [
    {
      name: `\u0417\u0430\u044f\u0432\u043a\u0430 \u0441 \u0441\u0430\u0439\u0442\u0430: ${identity}`,
      ...(leadCustomFields.length ? { custom_fields_values: leadCustomFields } : {}),
      _embedded: {
        contacts: [
          {
            name: name || identity,
            custom_fields_values: contactFields,
          },
        ],
      },
    },
  ];

  let leadId: number | null = null;

  try {
    const leadResponse = await $fetch<AmoComplexResponse>(`${amoBaseUrl}/api/v4/leads/complex`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${amoAccessToken}`,
      },
      body: leadPayload,
    });
    leadId = extractLeadId(leadResponse);
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      statusMessage:
        error?.data?.detail ||
        error?.data?.title ||
        error?.statusMessage ||
        'Failed to create amoCRM lead',
    });
  }

  if (!leadId) {
    throw createError({
      statusCode: 502,
      statusMessage: 'amoCRM did not return lead id',
    });
  }

  const noteText = getNoteText(city, comment, message);
  if (noteText) {
    try {
      await $fetch(`${amoBaseUrl}/api/v4/leads/${leadId}/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${amoAccessToken}`,
        },
        body: [
          {
            note_type: 'common',
            params: {
              text: noteText,
            },
          },
        ],
      });
    } catch (error: any) {
      throw createError({
        statusCode: 502,
        statusMessage:
          error?.data?.detail ||
          error?.data?.title ||
          error?.statusMessage ||
          'Lead created, but note was not added',
      });
    }
  }

  return { ok: true, leadId };
});
