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

function pickPromptUpdates(source: Json): Json {
  const updates: Json = {};
  if (source.title !== undefined) updates.title = source.title;
  if (source.content !== undefined) updates.content = source.content;
  if (source.category_id !== undefined) updates.category_id = source.category_id;
  if (source.tags !== undefined) updates.tags = source.tags;
  return updates;
}

function pickCategoryUpdates(source: Json): Json {
  const updates: Json = {};
  if (source.name !== undefined) updates.name = source.name;
  if (source.color !== undefined) updates.color = source.color;
  return updates;
}

async function parseBody(request: Request): Promise<Json> {
  if (request.method === 'GET' || request.method === 'OPTIONS') return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
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
    return jsonResponse({ ok: true, action, data: { service: 'lumina-prompts-api' } });
  }

  if (!userId) {
    return jsonResponse({ ok: false, error: 'user_id is required' }, 400);
  }

  try {
    const supabase = getClient();

    switch (action) {
      case 'list-categories': {
        const { data, error } = await supabase
          .from('prompt_categories')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { count: data?.length || 0, items: data || [] } });
      }

      case 'create-category': {
        const name = String(body.name || '').trim();
        const color = String(body.color || 'gray').trim() || 'gray';
        if (!name) return jsonResponse({ ok: false, error: 'name is required' }, 400);

        const { data, error } = await supabase
          .from('prompt_categories')
          .insert({ user_id: userId, name, color })
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'update-category': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const updates = pickCategoryUpdates(body);
        if (Object.keys(updates).length === 0) {
          return jsonResponse({ ok: false, error: 'no updatable fields provided' }, 400);
        }

        const { data, error } = await supabase
          .from('prompt_categories')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'delete-category': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase.from('prompt_categories').delete().eq('id', id).eq('user_id', userId);
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id } });
      }

      case 'list-prompts': {
        const includeDeleted = parseBoolean(body.include_deleted ?? url.searchParams.get('include_deleted'));
        const limitRaw = Number(body.limit ?? url.searchParams.get('limit') ?? 50);
        const offsetRaw = Number(body.offset ?? url.searchParams.get('offset') ?? 0);
        const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
        const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

        let query = supabase
          .from('prompts')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (includeDeleted) {
          query = query.not('deleted_at', 'is', null);
        } else {
          query = query.is('deleted_at', null);
        }

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

      case 'create-prompt': {
        const title = String(body.title || '').trim();
        const content = String(body.content || '').trim();
        if (!title || !content) return jsonResponse({ ok: false, error: 'title and content are required' }, 400);

        const payload: Json = {
          user_id: userId,
          title,
          content,
          category_id: body.category_id ?? null,
          tags: Array.isArray(body.tags) ? body.tags : [],
        };

        const { data, error } = await supabase.from('prompts').insert(payload).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'update-prompt': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const updates = pickPromptUpdates(body);
        if (Object.keys(updates).length === 0) {
          return jsonResponse({ ok: false, error: 'no updatable fields provided' }, 400);
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('prompts')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'delete-prompt': {
        const id = String(body.id || '').trim();
        const hard = parseBoolean(body.hard_delete);
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);

        if (hard) {
          const { error } = await supabase.from('prompts').delete().eq('id', id).eq('user_id', userId);
          if (error) throw error;
          return jsonResponse({ ok: true, action, data: { id, hard_delete: true } });
        }

        const { error } = await supabase
          .from('prompts')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id, hard_delete: false } });
      }

      case 'restore-prompt': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase
          .from('prompts')
          .update({ deleted_at: null, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
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
