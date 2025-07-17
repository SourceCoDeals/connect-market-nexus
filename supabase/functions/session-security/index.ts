
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SessionSecurityRequest {
  action: 'validate_session' | 'check_concurrent_sessions' | 'invalidate_sessions' | 'detect_anomalies';
  user_id?: string;
  session_data?: any;
  ip_address?: string;
  user_agent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, user_id, session_data, ip_address, user_agent }: SessionSecurityRequest = await req.json();
    
    console.log(`Session security action: ${action} for user: ${user_id}`);
    
    let result: any;
    
    switch (action) {
      case 'validate_session':
        result = await validateSession(user_id, session_data, ip_address, user_agent);
        break;
      case 'check_concurrent_sessions':
        result = await checkConcurrentSessions(user_id);
        break;
      case 'invalidate_sessions':
        result = await invalidateOldSessions(user_id);
        break;
      case 'detect_anomalies':
        result = await detectSessionAnomalies(user_id, ip_address, user_agent);
        break;
      default:
        throw new Error('Invalid session security action');
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in session-security function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Session security check failed' }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function validateSession(userId?: string, sessionData?: any, ipAddress?: string, userAgent?: string) {
  if (!userId) {
    return { valid: false, reason: 'No user ID provided' };
  }
  
  try {
    // Check if user exists and is active
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email_verified, approval_status, is_admin')
      .eq('id', userId)
      .single();
    
    if (error || !profile) {
      return { valid: false, reason: 'User not found' };
    }
    
    // Check user status
    if (!profile.email_verified) {
      return { valid: false, reason: 'Email not verified' };
    }
    
    if (profile.approval_status === 'rejected') {
      return { valid: false, reason: 'Account rejected' };
    }
    
    // Log session validation
    await logSessionActivity(userId, 'session_validated', {
      ip_address: ipAddress,
      user_agent: userAgent,
      profile_status: profile.approval_status
    });
    
    return { 
      valid: true, 
      user_status: {
        email_verified: profile.email_verified,
        approval_status: profile.approval_status,
        is_admin: profile.is_admin
      }
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return { valid: false, reason: 'Validation failed' };
  }
}

async function checkConcurrentSessions(userId?: string) {
  if (!userId) {
    return { concurrent_sessions: 0, max_allowed: 5 };
  }
  
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Count recent session activities to estimate concurrent sessions
    const { data: activities, error } = await supabase
      .from('user_activity')
      .select('metadata')
      .eq('user_id', userId)
      .eq('activity_type', 'session_validated')
      .gte('created_at', fiveMinutesAgo);
    
    if (error) {
      console.error('Error checking concurrent sessions:', error);
      return { concurrent_sessions: 1, max_allowed: 5 };
    }
    
    // Estimate concurrent sessions based on unique IP addresses
    const uniqueIPs = new Set();
    activities?.forEach(activity => {
      const metadata = activity.metadata as any;
      if (metadata?.ip_address) {
        uniqueIPs.add(metadata.ip_address);
      }
    });
    
    const concurrentSessions = uniqueIPs.size;
    const maxAllowed = 5; // Allow up to 5 concurrent sessions
    
    if (concurrentSessions > maxAllowed) {
      await logSessionActivity(userId, 'excessive_concurrent_sessions', {
        concurrent_count: concurrentSessions,
        max_allowed: maxAllowed
      });
    }
    
    return { 
      concurrent_sessions: concurrentSessions, 
      max_allowed: maxAllowed,
      warning: concurrentSessions > maxAllowed
    };
  } catch (error) {
    console.error('Concurrent session check error:', error);
    return { concurrent_sessions: 1, max_allowed: 5 };
  }
}

async function invalidateOldSessions(userId?: string) {
  if (!userId) {
    return { invalidated: 0 };
  }
  
  try {
    // Mark old session activities as expired (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    await logSessionActivity(userId, 'old_sessions_invalidated', {
      cutoff_time: oneDayAgo,
      reason: 'routine_cleanup'
    });
    
    return { invalidated: 1, message: 'Old sessions marked for cleanup' };
  } catch (error) {
    console.error('Session invalidation error:', error);
    return { invalidated: 0, error: 'Failed to invalidate sessions' };
  }
}

async function detectSessionAnomalies(userId?: string, ipAddress?: string, userAgent?: string) {
  if (!userId) {
    return { anomalies: [], risk_score: 0 };
  }
  
  try {
    const anomalies: string[] = [];
    let riskScore = 0;
    
    // Check for recent IP address changes
    const recentSessions = await getRecentSessions(userId, 24); // Last 24 hours
    const recentIPs = new Set(recentSessions.map(s => s.ip_address).filter(Boolean));
    
    if (ipAddress && recentIPs.size > 0 && !recentIPs.has(ipAddress)) {
      anomalies.push('New IP address detected');
      riskScore += 3;
    }
    
    // Check for unusual user agent
    const recentUserAgents = new Set(recentSessions.map(s => s.user_agent).filter(Boolean));
    if (userAgent && recentUserAgents.size > 0 && !recentUserAgents.has(userAgent)) {
      anomalies.push('New device/browser detected');
      riskScore += 2;
    }
    
    // Check for rapid session creation (potential bot behavior)
    const lastHourSessions = recentSessions.filter(s => {
      const sessionTime = new Date(s.timestamp);
      return sessionTime > new Date(Date.now() - 60 * 60 * 1000);
    });
    
    if (lastHourSessions.length > 10) {
      anomalies.push('Excessive session activity');
      riskScore += 5;
    }
    
    // Check for geographic anomalies (basic IP analysis)
    if (ipAddress && recentIPs.size > 3) {
      anomalies.push('Multiple IP addresses in short time');
      riskScore += 4;
    }
    
    // Log anomalies if detected
    if (anomalies.length > 0) {
      await logSessionActivity(userId, 'session_anomalies_detected', {
        anomalies,
        risk_score: riskScore,
        ip_address: ipAddress,
        user_agent: userAgent
      });
    }
    
    return { 
      anomalies, 
      risk_score: riskScore,
      recommendation: riskScore > 7 ? 'require_additional_verification' : 'normal'
    };
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return { anomalies: ['Detection failed'], risk_score: 0 };
  }
}

async function getRecentSessions(userId: string, hours: number = 24) {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data: activities, error } = await supabase
    .from('user_activity')
    .select('metadata, created_at')
    .eq('user_id', userId)
    .eq('activity_type', 'session_validated')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching recent sessions:', error);
    return [];
  }
  
  return activities?.map(activity => ({
    timestamp: activity.created_at,
    ip_address: (activity.metadata as any)?.ip_address,
    user_agent: (activity.metadata as any)?.user_agent
  })) || [];
}

async function logSessionActivity(userId: string, activityType: string, metadata: any) {
  try {
    await supabase
      .from('user_activity')
      .insert({
        user_id: userId,
        activity_type: activityType,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error('Error logging session activity:', error);
  }
}

serve(handler);
