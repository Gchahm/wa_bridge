export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      chats: {
        Row: {
          chat_id: string | null
          created_at: string | null
          is_group: boolean | null
          last_message_at: string | null
          name: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          first_seen_at: string | null
          last_seen_at: string | null
          phone_number: string | null
          push_name: string | null
        }
        Insert: {
          first_seen_at?: string | null
          last_seen_at?: string | null
          phone_number?: string | null
          push_name?: string | null
        }
        Update: {
          first_seen_at?: string | null
          last_seen_at?: string | null
          phone_number?: string | null
          push_name?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string | null
          created_at: string | null
          is_agent: boolean | null
          is_from_me: boolean | null
          media_path: string | null
          media_type: string | null
          message_id: string | null
          message_type: string | null
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          is_agent?: boolean | null
          is_from_me?: boolean | null
          media_path?: string | null
          media_type?: string | null
          message_id?: string | null
          message_type?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          is_agent?: boolean | null
          is_from_me?: boolean | null
          media_path?: string | null
          media_type?: string | null
          message_id?: string | null
          message_type?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "fk_messages_sender"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["phone_number"]
          },
        ]
      }
      outgoing_messages: {
        Row: {
          chat_id: string | null
          content: string | null
          created_at: string | null
          error_message: string | null
          id: number | null
          sent_at: string | null
          sent_message_id: string | null
          status: string | null
        }
        Insert: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: number | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_outgoing_messages_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["chat_id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  wa_bridge: {
    Tables: {
      chats: {
        Row: {
          chat_id: string
          created_at: string | null
          is_group: boolean
          last_message_at: string | null
          name: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          first_seen_at: string | null
          last_seen_at: string | null
          phone_number: string
          push_name: string | null
        }
        Insert: {
          first_seen_at?: string | null
          last_seen_at?: string | null
          phone_number: string
          push_name?: string | null
        }
        Update: {
          first_seen_at?: string | null
          last_seen_at?: string | null
          phone_number?: string
          push_name?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string | null
          is_agent: boolean
          is_from_me: boolean
          media_path: string | null
          media_type: string | null
          message_id: string
          message_type: string
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string | null
          is_agent?: boolean
          is_from_me?: boolean
          media_path?: string | null
          media_type?: string | null
          message_id: string
          message_type?: string
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string | null
          is_agent?: boolean
          is_from_me?: boolean
          media_path?: string | null
          media_type?: string | null
          message_id?: string
          message_type?: string
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["chat_id"]
          },
          {
            foreignKeyName: "fk_messages_sender"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["phone_number"]
          },
        ]
      }
      outgoing_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          error_message: string | null
          id: number
          sent_at: string | null
          sent_message_id: string | null
          status: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          error_message?: string | null
          id?: never
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          error_message?: string | null
          id?: never
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_outgoing_messages_chat"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["chat_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  wa_bridge: {
    Enums: {},
  },
} as const

