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

function detectTypeFromUrl(url: string): 'github' | 'link' {
  if (url.includes('github.com')) return 'github';
  return 'link';
}

function generateTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    return `${parsed.host}${path}`;
  } catch {
    return url;
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
    return jsonResponse({ ok: true, action, data: { service: 'lumina-resources-api' } });
  }

  if (!userId) {
    return jsonResponse({ ok: false, error: 'user_id is required' }, 400);
  }

  try {
    const supabase = getClient();

    switch (action) {
      case 'list-resources': {
        const includeDeleted = parseBoolean(body.include_deleted ?? url.searchParams.get('include_deleted'));
        const archived = parseBoolean(body.archived ?? url.searchParams.get('archived'));
        const type = String(body.type || url.searchParams.get('type') || '').trim();
        const limitRaw = Number(body.limit ?? url.searchParams.get('limit') ?? 50);
        const offsetRaw = Number(body.offset ?? url.searchParams.get('offset') ?? 0);
        const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));
        const offset = Math.max(0, Number.isFinite(offsetRaw) ? offsetRaw : 0);

        let query = supabase
          .from('resources')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (includeDeleted) {
          query = query.not('deleted_at', 'is', null);
        } else {
          query = query.is('deleted_at', null);
        }

        query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);

        if (type) {
          query = query.eq('type', type);
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

      case 'create-link-resource': {
        const targetUrl = String(body.url || '').trim();
        if (!targetUrl) return jsonResponse({ ok: false, error: 'url is required' }, 400);

        const type = detectTypeFromUrl(targetUrl);
        const title = String(body.title || '').trim() || generateTitleFromUrl(targetUrl);
        const description = body.description ?? null;
        const metadata = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {};

        const { data, error } = await supabase
          .from('resources')
          .insert({
            user_id: userId,
            type,
            title,
            description,
            url: targetUrl,
            metadata,
          })
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'create-resource': {
        const type = String(body.type || '').trim();
        const title = String(body.title || '').trim();
        if (!type || !title) return jsonResponse({ ok: false, error: 'type and title are required' }, 400);

        const payload: Json = {
          user_id: userId,
          type,
          title,
          description: body.description ?? null,
          url: body.url ?? null,
          storage_path: body.storage_path ?? null,
          file_name: body.file_name ?? null,
          metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {},
        };

        const { data, error } = await supabase.from('resources').insert(payload).select().single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'update-resource': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);

        const updates: Json = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.url !== undefined) updates.url = body.url;
        if (body.metadata !== undefined) updates.metadata = body.metadata;
        if (Object.keys(updates).length === 0) {
          return jsonResponse({ ok: false, error: 'no updatable fields provided' }, 400);
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from('resources')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw error;
        return jsonResponse({ ok: true, action, data });
      }

      case 'delete-resource': {
        const id = String(body.id || '').trim();
        const hard = parseBoolean(body.hard_delete);
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);

        if (hard) {
          const { data: existing, error: fetchError } = await supabase
            .from('resources')
            .select('storage_path')
            .eq('id', id)
            .eq('user_id', userId)
            .single();
          if (fetchError) throw fetchError;
          if (existing?.storage_path) {
            await supabase.storage.from('resources').remove([existing.storage_path]);
          }

          const { error } = await supabase.from('resources').delete().eq('id', id).eq('user_id', userId);
          if (error) throw error;
          return jsonResponse({ ok: true, action, data: { id, hard_delete: true } });
        }

        const { error } = await supabase
          .from('resources')
          .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id, hard_delete: false } });
      }

      case 'restore-resource': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase
          .from('resources')
          .update({ deleted_at: null, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id } });
      }

      case 'archive-resource': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase
          .from('resources')
          .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw error;
        return jsonResponse({ ok: true, action, data: { id } });
      }

      case 'unarchive-resource': {
        const id = String(body.id || '').trim();
        if (!id) return jsonResponse({ ok: false, error: 'id is required' }, 400);
        const { error } = await supabase
          .from('resources')
          .update({ archived_at: null, updated_at: new Date().toISOString() })
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
