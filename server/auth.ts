import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Middleware to extract and verify JWT from Authorization header
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      // No token provided - user is anonymous
      (req as any).user = null;
      return next();
    }

    if (!supabase) {
      console.error('Supabase client not initialized');
      (req as any).user = null;
      return next();
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      // Invalid token - treat as anonymous
      console.warn('Invalid auth token:', error?.message);
      (req as any).user = null;
      return next();
    }

    // Attach user to request
    (req as any).user = {
      id: user.id,
      email: user.email,
      metadata: user.user_metadata
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    (req as any).user = null;
    next();
  }
}

// Helper function to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ 
      error: 'Authentication required. Please sign in to continue.' 
    });
  }
  next();
}

// Get user ID from request (Supabase user or fallback to ownerId)
export function getUserId(req: Request): string | null {
  const user = (req as any).user;
  if (user?.id) {
    return user.id;
  }
  
  // Fallback to ownerId for backwards compatibility during migration
  const ownerId = req.headers['x-owner-id'] as string;
  return ownerId || null;
}

// Check if user has access to a resource
export function hasAccess(resourceUserId: string | null, resourceOwnerId: string | null, currentUserId: string | null, currentOwnerId: string | null): boolean {
  // If resource has a userId, check against current user
  if (resourceUserId && currentUserId) {
    return resourceUserId === currentUserId;
  }
  
  // Fallback to ownerId check for backwards compatibility
  if (resourceOwnerId && currentOwnerId) {
    return resourceOwnerId === currentOwnerId;
  }
  
  return false;
}