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
      booking_passengers: {
        Row: {
          booking_id: string
          passenger_id: string
          ticket_number: string | null
        }
        Insert: {
          booking_id: string
          passenger_id: string
          ticket_number?: string | null
        }
        Update: {
          booking_id?: string
          passenger_id?: string
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_booking_passengers_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'booking_payment_summary'
            referencedColumns: ['booking_id']
          },
          {
            foreignKeyName: 'fk_booking_passengers_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_booking_passengers_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings_summary'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_booking_passengers_passenger'
            columns: ['passenger_id']
            isOneToOne: false
            referencedRelation: 'passengers'
            referencedColumns: ['id']
          },
        ]
      }
      booking_segments: {
        Row: {
          airline: string | null
          arrival_at: string | null
          booking_id: string
          cabin_class: string | null
          departure_at: string | null
          destination: string
          flight_number: string | null
          id: string
          origin: string
          segment_order: number
        }
        Insert: {
          airline?: string | null
          arrival_at?: string | null
          booking_id: string
          cabin_class?: string | null
          departure_at?: string | null
          destination: string
          flight_number?: string | null
          id?: string
          origin: string
          segment_order: number
        }
        Update: {
          airline?: string | null
          arrival_at?: string | null
          booking_id?: string
          cabin_class?: string | null
          departure_at?: string | null
          destination?: string
          flight_number?: string | null
          id?: string
          origin?: string
          segment_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'fk_booking_segments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'booking_payment_summary'
            referencedColumns: ['booking_id']
          },
          {
            foreignKeyName: 'fk_booking_segments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_booking_segments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings_summary'
            referencedColumns: ['id']
          },
        ]
      }
      bookings: {
        Row: {
          booking_source: string | null
          created_at: string | null
          currency: string | null
          customer_id: string
          flight_request_id: string | null
          id: string
          notes: string | null
          pnr: string | null
          status: string
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          booking_source?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          flight_request_id?: string | null
          id?: string
          notes?: string | null
          pnr?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_source?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          flight_request_id?: string | null
          id?: string
          notes?: string | null
          pnr?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_bookings_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests_summary'
            referencedColumns: ['id']
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          currency: string | null
          id: string
          notes: string | null
          received_at: string | null
          status: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: string | null
          received_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_commissions_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'booking_payment_summary'
            referencedColumns: ['booking_id']
          },
          {
            foreignKeyName: 'fk_commissions_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_commissions_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings_summary'
            referencedColumns: ['id']
          },
        ]
      }
      customer_passengers: {
        Row: {
          customer_id: string
          label: string | null
          passenger_id: string
        }
        Insert: {
          customer_id: string
          label?: string | null
          passenger_id: string
        }
        Update: {
          customer_id?: string
          label?: string | null
          passenger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_customer_passengers_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_customer_passengers_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_customer_passengers_passenger'
            columns: ['passenger_id']
            isOneToOne: false
            referencedRelation: 'passengers'
            referencedColumns: ['id']
          },
        ]
      }
      customer_relationships: {
        Row: {
          customer_id: string
          related_customer_id: string
          relationship_type: string
        }
        Insert: {
          customer_id: string
          related_customer_id: string
          relationship_type: string
        }
        Update: {
          customer_id?: string
          related_customer_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_customer_relationships_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_customer_relationships_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_customer_relationships_related'
            columns: ['related_customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_customer_relationships_related'
            columns: ['related_customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          phone_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_customers_contact'
            columns: ['phone_number']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'fk_customers_contact'
            columns: ['phone_number']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
          },
        ]
      }
      flight_request_passengers: {
        Row: {
          flight_request_id: string
          passenger_id: string
        }
        Insert: {
          flight_request_id: string
          passenger_id: string
        }
        Update: {
          flight_request_id?: string
          passenger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fk_flight_request_passengers_passenger'
            columns: ['passenger_id']
            isOneToOne: false
            referencedRelation: 'passengers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_flight_request_passengers_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_flight_request_passengers_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests_summary'
            referencedColumns: ['id']
          },
        ]
      }
      flight_requests: {
        Row: {
          adults: number | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          cabin_class: string | null
          chat_id: string | null
          children: number | null
          created_at: string | null
          customer_id: string
          departure_date_end: string | null
          departure_date_start: string | null
          destination: string | null
          id: string
          infants: number | null
          notes: string | null
          origin: string | null
          return_date_end: string | null
          return_date_start: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          adults?: number | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          cabin_class?: string | null
          chat_id?: string | null
          children?: number | null
          created_at?: string | null
          customer_id: string
          departure_date_end?: string | null
          departure_date_start?: string | null
          destination?: string | null
          id?: string
          infants?: number | null
          notes?: string | null
          origin?: string | null
          return_date_end?: string | null
          return_date_start?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          adults?: number | null
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
          cabin_class?: string | null
          chat_id?: string | null
          children?: number | null
          created_at?: string | null
          customer_id?: string
          departure_date_end?: string | null
          departure_date_start?: string | null
          destination?: string | null
          id?: string
          infants?: number | null
          notes?: string | null
          origin?: string | null
          return_date_end?: string | null
          return_date_start?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_flight_requests_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_flight_requests_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats_with_preview'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_flight_requests_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_flight_requests_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
        ]
      }
      passengers: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          document_number: string | null
          document_type: string | null
          frequent_flyer_airline: string | null
          frequent_flyer_number: string | null
          full_name: string
          gender: string | null
          id: string
          nationality: string | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type?: string | null
          frequent_flyer_airline?: string | null
          frequent_flyer_number?: string | null
          full_name: string
          gender?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type?: string | null
          frequent_flyer_airline?: string | null
          frequent_flyer_number?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          nationality?: string | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          installments: number | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reference: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_payments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'booking_payment_summary'
            referencedColumns: ['booking_id']
          },
          {
            foreignKeyName: 'fk_payments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_payments_booking'
            columns: ['booking_id']
            isOneToOne: false
            referencedRelation: 'bookings_summary'
            referencedColumns: ['id']
          },
        ]
      }
      quote_options: {
        Row: {
          created_at: string | null
          currency: string | null
          departure_date: string | null
          description: string
          flight_request_id: string
          id: string
          is_selected: boolean | null
          notes: string | null
          price: number | null
          return_date: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          departure_date?: string | null
          description: string
          flight_request_id: string
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          price?: number | null
          return_date?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          departure_date?: string | null
          description?: string
          flight_request_id?: string
          id?: string
          is_selected?: boolean | null
          notes?: string | null
          price?: number | null
          return_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_quote_options_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_quote_options_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests_summary'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      booking_payment_summary: {
        Row: {
          booking_id: string | null
          commission_amount: number | null
          commission_status: string | null
          currency: string | null
          total_paid: number | null
          total_pending: number | null
          total_price: number | null
          total_refunded: number | null
        }
        Relationships: []
      }
      bookings_summary: {
        Row: {
          booking_source: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          departure_at_display: string | null
          flight_request_id: string | null
          id: string | null
          notes: string | null
          passenger_count: number | null
          pnr: string | null
          route_destination: string | null
          route_origin: string | null
          status: string | null
          total_price: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_bookings_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_bookings_flight_request'
            columns: ['flight_request_id']
            isOneToOne: false
            referencedRelation: 'flight_requests_summary'
            referencedColumns: ['id']
          },
        ]
      }
      chats: {
        Row: {
          chat_id: string | null
          contact_phone_number: string | null
          created_at: string | null
          is_group: boolean | null
          last_message_at: string | null
          name: string | null
        }
        Insert: {
          chat_id?: string | null
          contact_phone_number?: string | null
          created_at?: string | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
        }
        Update: {
          chat_id?: string | null
          contact_phone_number?: string | null
          created_at?: string | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'chats_contact_phone_number_fkey'
            columns: ['contact_phone_number']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'chats_contact_phone_number_fkey'
            columns: ['contact_phone_number']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
          },
        ]
      }
      chats_with_preview: {
        Row: {
          chat_id: string | null
          contact_phone_number: string | null
          created_at: string | null
          is_group: boolean | null
          last_message_at: string | null
          last_message_content: string | null
          last_message_is_from_me: boolean | null
          last_message_timestamp: string | null
          last_message_type: string | null
          name: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'chats_contact_phone_number_fkey'
            columns: ['contact_phone_number']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'chats_contact_phone_number_fkey'
            columns: ['contact_phone_number']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
          },
        ]
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
      customers_with_contact: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          notes: string | null
          phone: string | null
          phone_number: string | null
          updated_at: string | null
          wa_last_seen_at: string | null
          wa_push_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_customers_contact'
            columns: ['phone_number']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'fk_customers_contact'
            columns: ['phone_number']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
          },
        ]
      }
      flight_requests_summary: {
        Row: {
          adults: number | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
          cabin_class: string | null
          chat_id: string | null
          children: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          departure_date_end: string | null
          departure_date_start: string | null
          destination: string | null
          id: string | null
          infants: number | null
          notes: string | null
          origin: string | null
          passenger_count: number | null
          return_date_end: string | null
          return_date_start: string | null
          selected_quote_currency: string | null
          selected_quote_departure_date: string | null
          selected_quote_description: string | null
          selected_quote_price: number | null
          selected_quote_return_date: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_flight_requests_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_flight_requests_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats_with_preview'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_flight_requests_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fk_flight_requests_customer'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers_with_contact'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string | null
          created_at: string | null
          description: string | null
          edit_history: Json | null
          edited_at: string | null
          is_agent: boolean | null
          is_from_me: boolean | null
          media_path: string | null
          media_type: string | null
          message_id: string | null
          message_type: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          is_agent?: boolean | null
          is_from_me?: boolean | null
          media_path?: string | null
          media_type?: string | null
          message_id?: string | null
          message_type?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          is_agent?: boolean | null
          is_from_me?: boolean | null
          media_path?: string | null
          media_type?: string | null
          message_id?: string | null
          message_type?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats_with_preview'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_messages_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'fk_messages_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
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
            foreignKeyName: 'fk_outgoing_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_outgoing_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats_with_preview'
            referencedColumns: ['chat_id']
          },
        ]
      }
      reactions: {
        Row: {
          chat_id: string | null
          created_at: string | null
          emoji: string | null
          message_id: string | null
          sender_id: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id?: string | null
          created_at?: string | null
          emoji?: string | null
          message_id?: string | null
          sender_id?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string | null
          created_at?: string | null
          emoji?: string | null
          message_id?: string | null
          sender_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_reactions_message'
            columns: ['message_id', 'chat_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['message_id', 'chat_id']
          },
          {
            foreignKeyName: 'fk_reactions_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
          {
            foreignKeyName: 'fk_reactions_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'unlinked_contacts'
            referencedColumns: ['phone_number']
          },
        ]
      }
      unlinked_contacts: {
        Row: {
          last_seen_at: string | null
          phone_number: string | null
          push_name: string | null
        }
        Relationships: []
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
          contact_phone_number: string | null
          created_at: string | null
          is_group: boolean
          last_message_at: string | null
          name: string | null
        }
        Insert: {
          chat_id: string
          contact_phone_number?: string | null
          created_at?: string | null
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
        }
        Update: {
          chat_id?: string
          contact_phone_number?: string | null
          created_at?: string | null
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'chats_contact_phone_number_fkey'
            columns: ['contact_phone_number']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
          },
        ]
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
          description: string | null
          edit_history: Json | null
          edited_at: string | null
          is_agent: boolean
          is_from_me: boolean
          media_path: string | null
          media_type: string | null
          message_id: string
          message_type: string
          reply_to_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          timestamp: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          is_agent?: boolean
          is_from_me?: boolean
          media_path?: string | null
          media_type?: string | null
          message_id: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          edit_history?: Json | null
          edited_at?: string | null
          is_agent?: boolean
          is_from_me?: boolean
          media_path?: string | null
          media_type?: string | null
          message_id?: string
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
          {
            foreignKeyName: 'fk_messages_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
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
            foreignKeyName: 'fk_outgoing_messages_chat'
            columns: ['chat_id']
            isOneToOne: false
            referencedRelation: 'chats'
            referencedColumns: ['chat_id']
          },
        ]
      }
      reactions: {
        Row: {
          chat_id: string
          created_at: string | null
          emoji: string
          message_id: string
          sender_id: string
          timestamp: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          emoji: string
          message_id: string
          sender_id: string
          timestamp?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          emoji?: string
          message_id?: string
          sender_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fk_reactions_message'
            columns: ['message_id', 'chat_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['message_id', 'chat_id']
          },
          {
            foreignKeyName: 'fk_reactions_sender'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['phone_number']
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
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
