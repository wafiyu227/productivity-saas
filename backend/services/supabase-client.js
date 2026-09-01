import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;

try {
  if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL ERROR: Missing Supabase credentials in .env file');
    if (!supabaseUrl) console.error('SUPABASE_URL is missing');
    if (!supabaseKey) console.error('SUPABASE Key is missing');
    // We create a dummy/proxy client that will throw when used, 
    // rather than throwing at module load time.
    supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: new Error('Database not configured: Missing Supabase credentials') }) }) }),
        insert: () => Promise.resolve({ data: null, error: new Error('Database not configured') }),
        update: () => Promise.resolve({ data: null, error: new Error('Database not configured') }),
        upsert: () => Promise.resolve({ data: null, error: new Error('Database not configured') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Database not configured') })
      }),
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: new Error('Database not configured') }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      }
    };
  } else {
    console.log('Supabase client initialized with URL:', supabaseUrl.substring(0, 15) + '...');
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
}


export { supabase };

const AGENT_CONVERSATION_TITLE_LIMIT = 160;
const AGENT_MESSAGE_PREVIEW_LIMIT = 180;

function asJsonObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function sanitizeConversationTitle(title) {
  const normalized = typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : '';
  return normalized.slice(0, AGENT_CONVERSATION_TITLE_LIMIT) || 'New chat';
}

function buildMessagePreview(content) {
  if (typeof content !== 'string') return null;

  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return normalized.slice(0, AGENT_MESSAGE_PREVIEW_LIMIT);
}

export const db = {
  supabase,
  async saveSlackSummary(data) {
    const summaryData = {
      user_id: data.user_id,
      channel_id: data.channel_id,
      channel_name: data.channel_name,
      team_id: data.team_id,
      summary: data.summary,
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      key_topics: Array.isArray(data.key_topics) ? data.key_topics : [],
      message_count: data.message_count || 0,
      time_period_start: data.time_period_start,
      time_period_end: data.time_period_end
    };

    const { data: result, error } = await supabase
      .from('slack_summaries')
      .insert([summaryData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving summary:', error);
      throw error;
    }

    return result;
  },

  async getSummaries(userId, limit = 10) {
    if (!userId) throw new Error('userId required');

    const { data, error } = await supabase
      .from('slack_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },


  // FIXED: saveIntegration with proper conflict resolution
  async saveIntegration(userId, platform, tokens) {
    if (!tokens?.accessToken) {
      throw new Error('saveIntegration requires accessToken');
    }

    const integrationData = {
      user_id: userId,
      platform,
      scope: 'personal',
      access_token: tokens.accessToken,
      updated_at: new Date().toISOString()
    };

    if (tokens.refreshToken !== undefined) integrationData.refresh_token = tokens.refreshToken;
    if (tokens.expiresAt !== undefined) integrationData.expires_at = tokens.expiresAt;
    if (tokens.workspaceId !== undefined) integrationData.workspace_id = tokens.workspaceId;
    if (tokens.workspaceName !== undefined) integrationData.workspace_name = tokens.workspaceName;

    console.log('Saving individual integration:', integrationData);

    const { data: existing, error: existingError } = await supabase
      .from('integrations')
      .select('id, metadata')
      .eq('platform', platform)
      .eq('user_id', userId)
      .eq('scope', 'personal')
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    const nextMetadata = {
      ...(existing?.metadata || {}),
      ...(tokens.metadata || {})
    };

    if (tokens.grantedScopes !== undefined) {
      nextMetadata.grantedScopes = Array.isArray(tokens.grantedScopes) ? tokens.grantedScopes : [];
      nextMetadata.scopeList = Array.isArray(tokens.grantedScopes) ? tokens.grantedScopes : [];
    }

    if (tokens.scope !== undefined || tokens.oauthScope !== undefined) {
      nextMetadata.oauthScope = tokens.oauthScope ?? tokens.scope;
    }

    if (Object.keys(nextMetadata).length > 0) {
      integrationData.metadata = nextMetadata;
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from('integrations')
        .update(integrationData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('integrations')
      .insert(integrationData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },


  // FIXED: getIntegration with correct logic
  async getIntegration(userId, platform) {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('platform', platform)
      .eq('user_id', userId)
      .eq('scope', 'personal')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },


  async deleteIntegration(userId, platform) {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('platform', platform)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },


  // User Profile Methods
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getProfileByEmail(email) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },



  async getUserSettings(userId) {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings:', error);
      return null;
    }

    // Default settings if none found
    return data || {
      email_notifications: true,
      slack_notifications: true,
      blocker_alerts: false,
      daily_digest: false
    };
  },

  async upsertProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return this.upsertProfile(userId, profileData);
    }

    return data[0];
  },

  async listAgentConversations(userId, options = {}) {
    if (!userId) throw new Error('userId required');

    const {
      limit = 50,
      includeDeleted = false,
      conversationKind = null
    } = options;

    let query = supabase
      .from('agent_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100));

    if (!includeDeleted) {
      query = query.neq('status', 'deleted');
    }

    if (conversationKind) {
      query = query.eq('conversation_kind', conversationKind);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAgentConversation(conversationId, userId) {
    if (!conversationId) throw new Error('conversationId required');

    let query = supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', conversationId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getAgentConversationByShareToken(shareToken) {
    if (!shareToken) throw new Error('shareToken required');

    const { data, error } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_shared', true)
      .neq('status', 'deleted')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createAgentConversation(userId, conversationData = {}) {
    if (!userId) throw new Error('userId required');

    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      title: sanitizeConversationTitle(conversationData.title),
      title_source: conversationData.titleSource || 'system',
      conversation_kind: conversationData.conversationKind || 'chat',
      status: conversationData.status || 'active',
      is_shared: Boolean(conversationData.isShared),
      share_token: conversationData.shareToken ?? null,
      shared_at: conversationData.isShared ? (conversationData.sharedAt || now) : null,
      deleted_at: conversationData.deletedAt ?? null,
      last_message_at: conversationData.lastMessageAt || now,
      last_message_preview: buildMessagePreview(
        conversationData.lastMessagePreview || conversationData.initialMessage || ''
      ),
      metadata: asJsonObject(conversationData.metadata),
      updated_at: now
    };

    const { data, error } = await supabase
      .from('agent_conversations')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAgentConversation(conversationId, userId, updates = {}) {
    if (!conversationId) throw new Error('conversationId required');
    if (!userId) throw new Error('userId required');

    const payload = {
      updated_at: new Date().toISOString()
    };

    if (updates.title !== undefined) payload.title = sanitizeConversationTitle(updates.title);
    if (updates.titleSource !== undefined) payload.title_source = updates.titleSource;
    if (updates.conversationKind !== undefined) payload.conversation_kind = updates.conversationKind;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.isShared !== undefined) payload.is_shared = Boolean(updates.isShared);
    if (updates.shareToken !== undefined) payload.share_token = updates.shareToken;
    if (updates.sharedAt !== undefined) payload.shared_at = updates.sharedAt;
    if (updates.deletedAt !== undefined) payload.deleted_at = updates.deletedAt;
    if (updates.lastMessageAt !== undefined) payload.last_message_at = updates.lastMessageAt;
    if (updates.lastMessagePreview !== undefined) {
      payload.last_message_preview = buildMessagePreview(updates.lastMessagePreview);
    }
    if (updates.metadata !== undefined) payload.metadata = asJsonObject(updates.metadata);

    const { data, error } = await supabase
      .from('agent_conversations')
      .update(payload)
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async renameAgentConversation(conversationId, userId, title) {
    return this.updateAgentConversation(conversationId, userId, {
      title,
      titleSource: 'user'
    });
  },

  async softDeleteAgentConversation(conversationId, userId) {
    const deletedAt = new Date().toISOString();
    return this.updateAgentConversation(conversationId, userId, {
      status: 'deleted',
      deletedAt
    });
  },

  async getAgentConversationMessages(conversationId, userId, options = {}) {
    if (!conversationId) throw new Error('conversationId required');
    if (!userId) throw new Error('userId required');

    const { limit = 200 } = options;

    const { data, error } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 500));

    if (error) throw error;
    return data || [];
  },

  async saveAgentMessages(conversationId, userId, messages = []) {
    if (!conversationId) throw new Error('conversationId required');
    if (!userId) throw new Error('userId required');

    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const rows = messages.map((message) => ({
      conversation_id: conversationId,
      user_id: userId,
      client_message_id: message.clientMessageId ?? message.id ?? null,
      role: message.role || 'assistant',
      message_kind: message.messageKind || 'chat',
      status: message.status || 'completed',
      content: typeof message.content === 'string' ? message.content : '',
      tool_name: message.toolName ?? null,
      tool_call_id: message.toolCallId ?? null,
      metadata: asJsonObject(message.metadata),
      created_at: message.createdAt || now,
      updated_at: message.updatedAt || now
    }));

    const { data, error } = await supabase
      .from('agent_messages')
      .insert(rows)
      .select();

    if (error) throw error;

    const lastMessage = [...rows].reverse().find((message) => message.content?.trim()) || rows[rows.length - 1];
    const { error: updateError } = await supabase
      .from('agent_conversations')
      .update({
        last_message_at: lastMessage?.created_at || now,
        last_message_preview: buildMessagePreview(lastMessage?.content),
        updated_at: now
      })
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return data || [];
  },

  async updateAgentMessage(messageId, userId, updates = {}) {
    if (!messageId) throw new Error('messageId required');
    if (!userId) throw new Error('userId required');

    const payload = {
      updated_at: new Date().toISOString()
    };

    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.content !== undefined) payload.content = typeof updates.content === 'string' ? updates.content : '';
    if (updates.messageKind !== undefined) payload.message_kind = updates.messageKind;
    if (updates.metadata !== undefined) payload.metadata = asJsonObject(updates.metadata);

    const { data, error } = await supabase
      .from('agent_messages')
      .update(payload)
      .eq('id', messageId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },



  async deleteUserAccount(userId) {
    // Delete all user-related data in cascade order to avoid foreign key issues

    // 1. Delete user integrations and settings
    await supabase.from('integrations').delete().eq('user_id', userId);
    await supabase.from('user_settings').delete().eq('user_id', userId);

    // 2. Delete user data from meetings, summaries, and analytics
    await supabase.from('slack_summaries').delete().eq('user_id', userId);

    // 3. Delete blockers and other user-generated content
    const { data: userBlockers } = await supabase
      .from('blockers')
      .select('id')
      .eq('user_id', userId);

    if (userBlockers && userBlockers.length > 0) {
      const blockerIds = userBlockers.map(b => b.id);
      await supabase.from('blockers').delete().in('id', blockerIds);
    }



    // 6. Delete user profile
    await supabase.from('profiles').delete().eq('id', userId);

    // 7. Delete Supabase auth user (must be last)
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  },

  async deleteSummary(summaryId, userId) {
    const { error } = await supabase
      .from('slack_summaries')
      .delete()
      .eq('id', summaryId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  },

  async listDismissedBlockers(userId) {
    const { data, error } = await supabase
      .from('dismissed_blockers')
      .select('blocker_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((item) => item.blocker_id);
  },

  async dismissBlocker(userId, blockerId) {
    const { data, error } = await supabase
      .from('dismissed_blockers')
      .upsert({ user_id: userId, blocker_id: blockerId, updated_at: new Date().toISOString() })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
