import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

type Json = Record<string, any>;

function jsonResponse(payload: Json, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function parseBoolean(value: unknown, defaultValue = false): boolean {
  if (value === null || value === undefined) return defaultValue;
  const raw = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(raw);
}

async function parseBody(request: Request): Promise<Json> {
  if (request.method === 'GET' || request.method === 'OPTIONS') return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// 文章正文可能是 markdown，从首个 `# ` 行兜底提取标题
function titleFromContent(content: string): string {
  const m = content.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : 'Untitled';
}

function getClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const url = new URL(request.url);
  const body = await parseBody(request);
  const action = String(body.action || url.searchParams.get('action') || '').trim().toLowerCase();
  const userId = String(body.user_id || url.searchParams.get('user_id') || '').trim();

  if (!action) {
    return jsonResponse({ ok: false, error: 'action is required' }, 400);
  }

  if (action === 'ping') {
    return jsonResponse({ ok: true, action, data: { service: 'lumina-articles-api' } });
  }

  if (!userId) {
    return jsonResponse({ ok: false, error: 'user_id is required' }, 400);
  }

  try {
    const supabase = getClient();

    switch (action) {
      case 'list-articles': {
        const includeDeleted = parseBoolean(body.include_deleted ?? url.searchParams.get('include_deleted'));
        const limitRaw = Number(body.limit ?? url.searchParams.get('limit') ?? 50);
        const offsetRaw = Number(body.offset ?? url.searchParams.get('offset') ?? 0);
        const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
        const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

        let query = supabase
          .from('ideas')
          .select('*')
          .eq('user_id', userId)
          .eq('kind', 'article')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        query = includeDeleted ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null);

        const { data, error } = await query;
        if (error) throw error;
        return jsonResponse({
          ok: true,
          action,
          data: {
            count: data?.length || 0,
            items: data || [],
            pagination: { limit, offset },
          },
        });
      }

      case 'create-article': {
        const content = String(body.content ?? '').trim();
        if (!content) return jsonResponse({ ok: false, error: 'content is required' }, 400);
        const title = String(body.title || '').trim() || titleFromContent(content);

        const payload: Json = {
          user_id: userId,
          kind: 'article',
          title,
          content,
          excerpt: body.excerpt ?? null,
          cover_url: body.cover_url ?? null,
          tags: Array.isArray(body.tags) ? body.tags : [],
          source: 'manual',
        };

        const { data, error } = await supabase.from('ideas').insert(payload).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'update-article': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);

        const updates: Json = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.content !== undefined) updates.content = body.content;
        if (body.excerpt !== undefined) updates.excerpt = body.excerpt;
        if (body.cover_url !== undefined) updates.cover_url = body.cover_url;
        if (body.tags !== undefined) updates.tags = body.tags;
        if (Object.keys(updates).length === 0) {
          return jsonResponse({ ok: false, error: 'no updatable fields provided' }, 400);
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('ideas')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .eq('kind', 'article')
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'delete-article': {
        const id = String(body.id || '').trim();
        const hard = parseBoolean(body.hard_delete);
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);

        if (hard) {
          const { error } = await supabase
            .from('ideas')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
            .eq('kind', 'article');
          if (error) throw error;
          return jsonResponse({ ok: true, action, data: { id, hard_delete: true } });
        }

        const { error } = await supabase
          .from('ideas')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId)
          .eq('kind', 'article');
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id, hard_delete: false } });
      }

      case 'restore-article': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase
          .from('ideas')
          .update({ deleted_at: null, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId)
          .eq('kind', 'article');
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id } });
      }

      default:
        return jsonResponse({ ok: false, error: `unsupported action: ${action}` }, 400);
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
}
