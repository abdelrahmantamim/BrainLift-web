export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          student_type: 'high_school' | 'university' | 'graduate' | 'professional' | 'other' | null
          subscription_tier: 'free' | 'premium' | 'ultra'
          subscription_end_date: string | null
          daily_ai_requests: number
          monthly_ai_requests: number
          total_ai_requests: number
          last_request_date: string
          last_reset_date: string
          study_streak: number
          last_study_date: string | null
          onboarding_completed: boolean
          preferences: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          student_type?: 'high_school' | 'university' | 'graduate' | 'professional' | 'other' | null
          subscription_tier?: 'free' | 'premium' | 'ultra'
          subscription_end_date?: string | null
          daily_ai_requests?: number
          monthly_ai_requests?: number
          total_ai_requests?: number
          last_request_date?: string
          last_reset_date?: string
          study_streak?: number
          last_study_date?: string | null
          onboarding_completed?: boolean
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          student_type?: 'high_school' | 'university' | 'graduate' | 'professional' | 'other' | null
          subscription_tier?: 'free' | 'premium' | 'ultra'
          subscription_end_date?: string | null
          daily_ai_requests?: number
          monthly_ai_requests?: number
          total_ai_requests?: number
          last_request_date?: string
          last_reset_date?: string
          study_streak?: number
          last_study_date?: string | null
          onboarding_completed?: boolean
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          subject: string
          difficulty_level: 'beginner' | 'intermediate' | 'advanced' | null
          ai_interactions: number
          duration_minutes: number
          start_time: string
          end_time: string | null
          status: 'active' | 'paused' | 'completed'
          goals: string[] | null
          achievements: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          subject: string
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          ai_interactions?: number
          duration_minutes?: number
          start_time?: string
          end_time?: string | null
          status?: 'active' | 'paused' | 'completed'
          goals?: string[] | null
          achievements?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          subject?: string
          difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | null
          ai_interactions?: number
          duration_minutes?: number
          start_time?: string
          end_time?: string | null
          status?: 'active' | 'paused' | 'completed'
          goals?: string[] | null
          achievements?: string[] | null
          created_at?: string
        }
      }
      uploaded_files: {
        Row: {
          id: string
          user_id: string
          session_id: string | null
          file_name: string
          original_name: string
          file_size: number
          file_type: string
          file_path: string
          thumbnail_path: string | null
          subject: string | null
          processing_status: 'pending' | 'processing' | 'completed' | 'failed'
          extracted_text: string | null
          summary: string | null
          key_concepts: string[] | null
          embeddings: number[] | null
          metadata: Record<string, any>
          upload_date: string
          processed_date: string | null
        }
        Insert: {
          id?: string
          user_id: string
          session_id?: string | null
          file_name: string
          original_name: string
          file_size: number
          file_type: string
          file_path: string
          thumbnail_path?: string | null
          subject?: string | null
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          extracted_text?: string | null
          summary?: string | null
          key_concepts?: string[] | null
          embeddings?: number[] | null
          metadata?: Record<string, any>
          upload_date?: string
          processed_date?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string | null
          file_name?: string
          original_name?: string
          file_size?: number
          file_type?: string
          file_path?: string
          thumbnail_path?: string | null
          subject?: string | null
          processing_status?: 'pending' | 'processing' | 'completed' | 'failed'
          extracted_text?: string | null
          summary?: string | null
          key_concepts?: string[] | null
          embeddings?: number[] | null
          metadata?: Record<string, any>
          upload_date?: string
          processed_date?: string | null
        }
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string
          session_id: string
          message_id: string
          role: 'user' | 'assistant'
          content: string
          attachments: any[]
          context_files: string[]
          tokens_used: number
          cost_cents: number
          model_used: string
          rating: number | null
          feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          message_id: string
          role: 'user' | 'assistant'
          content: string
          attachments?: any[]
          context_files?: string[]
          tokens_used?: number
          cost_cents?: number
          model_used?: string
          rating?: number | null
          feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          message_id?: string
          role?: 'user' | 'assistant'
          content?: string
          attachments?: any[]
          context_files?: string[]
          tokens_used?: number
          cost_cents?: number
          model_used?: string
          rating?: number | null
          feedback?: string | null
          created_at?: string
        }
      }
      subscription_usage: {
        Row: {
          user_id: string
          usage_date: string
          ai_requests: number
          tokens_used: number
          cost_cents: number
          feature_usage: Record<string, any>
        }
        Insert: {
          user_id: string
          usage_date?: string
          ai_requests?: number
          tokens_used?: number
          cost_cents?: number
          feature_usage?: Record<string, any>
        }
        Update: {
          user_id?: string
          usage_date?: string
          ai_requests?: number
          tokens_used?: number
          cost_cents?: number
          feature_usage?: Record<string, any>
        }
      }
      achievements: {
        Row: {
          id: string
          user_id: string
          achievement_type: string
          achievement_name: string
          description: string | null
          icon_name: string | null
          earned_date: string
          metadata: Record<string, any>
        }
        Insert: {
          id?: string
          user_id: string
          achievement_type: string
          achievement_name: string
          description?: string | null
          icon_name?: string | null
          earned_date?: string
          metadata?: Record<string, any>
        }
        Update: {
          id?: string
          user_id?: string
          achievement_type?: string
          achievement_name?: string
          description?: string | null
          icon_name?: string | null
          earned_date?: string
          metadata?: Record<string, any>
        }
      }
    }
    Views: {}
    Functions: {
      update_daily_usage: {
        Args: {
          p_user_id: string
          p_tokens: number
        }
        Returns: void
      }
      check_subscription_limits: {
        Args: {
          p_user_id: string
        }
        Returns: boolean
      }
      calculate_study_streak: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      search_user_content: {
        Args: {
          p_user_id: string
          p_query: string
          p_limit?: number
        }
        Returns: {
          file_id: string
          file_name: string
          relevance: number
          summary: string
          key_concepts: string[]
        }[]
      }
      reset_daily_counters: {
        Args: {}
        Returns: void
      }
      reset_monthly_counters: {
        Args: {}
        Returns: void
      }
    }
    Enums: {
      student_type: 'high_school' | 'university' | 'graduate' | 'professional' | 'other'
      subscription_tier: 'free' | 'premium' | 'ultra'
      difficulty_level: 'beginner' | 'intermediate' | 'advanced'
      study_status: 'active' | 'paused' | 'completed'
      processing_status: 'pending' | 'processing' | 'completed' | 'failed'
      chat_role: 'user' | 'assistant'
    }
  }
}

// Helper types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type StudySession = Database['public']['Tables']['study_sessions']['Row']
export type StudySessionInsert = Database['public']['Tables']['study_sessions']['Insert']
export type StudySessionUpdate = Database['public']['Tables']['study_sessions']['Update']

export type UploadedFile = Database['public']['Tables']['uploaded_files']['Row']
export type UploadedFileInsert = Database['public']['Tables']['uploaded_files']['Insert']
export type UploadedFileUpdate = Database['public']['Tables']['uploaded_files']['Update']

export type ChatConversation = Database['public']['Tables']['chat_conversations']['Row']
export type ChatConversationInsert = Database['public']['Tables']['chat_conversations']['Insert']
export type ChatConversationUpdate = Database['public']['Tables']['chat_conversations']['Update']

export type SubscriptionUsage = Database['public']['Tables']['subscription_usage']['Row']
export type SubscriptionUsageInsert = Database['public']['Tables']['subscription_usage']['Insert']
export type SubscriptionUsageUpdate = Database['public']['Tables']['subscription_usage']['Update']

export type Achievement = Database['public']['Tables']['achievements']['Row']
export type AchievementInsert = Database['public']['Tables']['achievements']['Insert']
export type AchievementUpdate = Database['public']['Tables']['achievements']['Update']

// Enum types
export type StudentType = Database['public']['Enums']['student_type']
export type SubscriptionTier = Database['public']['Enums']['subscription_tier']
export type DifficultyLevel = Database['public']['Enums']['difficulty_level']
export type StudyStatus = Database['public']['Enums']['study_status']
export type ProcessingStatus = Database['public']['Enums']['processing_status']
export type ChatRole = Database['public']['Enums']['chat_role']

// Subscription limits by tier
export const SUBSCRIPTION_LIMITS = {
  free: {
    daily_ai_requests: 10,
    monthly_ai_requests: 100,
    max_file_size_mb: 10,
    max_files_per_month: 20
  },
  premium: {
    daily_ai_requests: 100,
    monthly_ai_requests: 2000,
    max_file_size_mb: 50,
    max_files_per_month: 200
  },
  ultra: {
    daily_ai_requests: 999999,
    monthly_ai_requests: 999999,
    max_file_size_mb: 100,
    max_files_per_month: 999999
  }
} as const