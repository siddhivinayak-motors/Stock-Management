export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["app_action"] | null
          action_label: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          id: number
          module: Database["public"]["Enums"]["app_module"] | null
          record_id: string | null
          record_type: string | null
        }
        Insert: {
          action?: Database["public"]["Enums"]["app_action"] | null
          action_label: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          module?: Database["public"]["Enums"]["app_module"] | null
          record_id?: string | null
          record_type?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["app_action"] | null
          action_label?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: never
          module?: Database["public"]["Enums"]["app_module"] | null
          record_id?: string | null
          record_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      employee_permissions: {
        Row: {
          actions: Database["public"]["Enums"]["app_action"][]
          created_at: string
          granted_by: string | null
          id: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Database["public"]["Enums"]["app_action"][]
          created_at?: string
          granted_by?: string | null
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Database["public"]["Enums"]["app_action"][]
          created_at?: string
          granted_by?: string | null
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employee_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          colour: string
          department: string
          ex_showroom: number
          id: string
          other_data: Json
          rto: number
          variant: string
          vehicle: string
          version_id: string
        }
        Insert: {
          colour?: string
          department: string
          ex_showroom?: number
          id?: string
          other_data?: Json
          rto?: number
          variant?: string
          vehicle: string
          version_id: string
        }
        Update: {
          colour?: string
          department?: string
          ex_showroom?: number
          id?: string
          other_data?: Json
          rto?: number
          variant?: string
          vehicle?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "price_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_versions: {
        Row: {
          department: string
          id: string
          published_at: string
          published_by: string | null
          row_count: number
          source_file: string | null
          version_label: string
        }
        Insert: {
          department: string
          id?: string
          published_at?: string
          published_by?: string | null
          row_count?: number
          source_file?: string | null
          version_label: string
        }
        Update: {
          department?: string
          id?: string
          published_at?: string
          published_by?: string | null
          row_count?: number
          source_file?: string | null
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          city: string | null
          city_access: string[]
          department: string | null
          designation: string | null
          email: string
          employee_code: string | null
          full_name: string
          is_super_admin: boolean
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          city?: string | null
          city_access?: string[]
          department?: string | null
          designation?: string | null
          email: string
          employee_code?: string | null
          full_name?: string
          is_super_admin?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          city?: string | null
          city_access?: string[]
          department?: string | null
          designation?: string | null
          email?: string
          employee_code?: string | null
          full_name?: string
          is_super_admin?: boolean
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          amount: number
          id: string
          is_discount: boolean
          line_no: number
          particulars: string
          quotation_id: string
        }
        Insert: {
          amount?: number
          id?: string
          is_discount?: boolean
          line_no: number
          particulars: string
          quotation_id: string
        }
        Update: {
          amount?: number
          id?: string
          is_discount?: boolean
          line_no?: number
          particulars?: string
          quotation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          address: string | null
          amount_words: string | null
          approved_at: string | null
          approved_by: string | null
          bank_details: Json
          branch_address: string | null
          colour: string | null
          contact_mobile: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          department: string
          discount: number
          email: string | null
          gstin: string | null
          helpline: string | null
          hypo: string | null
          id: string
          model: string | null
          pan: string | null
          phone: string | null
          print_count: number
          quote_date: string
          quote_number: string
          sales_person: string | null
          status: string
          subtotal: number
          terms: Json
          total: number
          updated_at: string
          updated_by: string | null
          variant: string | null
          vehicle_count: number
        }
        Insert: {
          address?: string | null
          amount_words?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json
          branch_address?: string | null
          car_description?: string | null
          chassis?: string | null
          colour?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          department: string
          discount?: number
          email?: string | null
          gstin?: string | null
          helpline?: string | null
          hypo?: string | null
          id?: string
          model?: string | null
          pan?: string | null
          phone?: string | null
          print_count?: number
          quote_date?: string
          quote_number: string
          sales_person?: string | null
          status?: string
          subtotal?: number
          terms?: Json
          total?: number
          updated_at?: string
          updated_by?: string | null
          variant?: string | null
          vehicle_count?: number
        }
        Update: {
          address?: string | null
          amount_words?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json
          branch_address?: string | null
          car_description?: string | null
          chassis?: string | null
          colour?: string | null
          contact_mobile?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          department?: string
          discount?: number
          email?: string | null
          gstin?: string | null
          helpline?: string | null
          hypo?: string | null
          id?: string
          model?: string | null
          pan?: string | null
          phone?: string | null
          print_count?: number
          quote_date?: string
          quote_number?: string
          sales_person?: string | null
          status?: string
          subtotal?: number
          terms?: Json
          total?: number
          updated_at?: string
          updated_by?: string | null
          variant?: string | null
          vehicle_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "quotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      stock_holds: {
        Row: {
          approved_at: string | null
          approver_id: string | null
          created_at: string
          created_by: string | null
          department: string
          executive: string | null
          id: string
          reason: string
          status: string
          updated_at: string
          variant: string | null
          vehicle: string
          vehicle_id: string | null
          vin: string
        }
        Insert: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          department: string
          executive?: string | null
          id?: string
          reason: string
          status?: string
          updated_at?: string
          variant?: string | null
          vehicle: string
          vehicle_id?: string | null
          vin: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          executive?: string | null
          id?: string
          reason?: string
          status?: string
          updated_at?: string
          variant?: string | null
          vehicle?: string
          vehicle_id?: string | null
          vin?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_holds_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_holds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "stock_holds_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          error_rows: number
          file_name: string
          id: string
          imported_rows: number
          skipped_rows: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          error_rows?: number
          file_name: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          error_rows?: number
          file_name?: string
          id?: string
          imported_rows?: number
          skipped_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicles: {
        Row: {
          chassis_number: string
          colour: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          department: string
          engine_number: string | null
          excel_number: string | null
          id: string
          imported_at: string | null
          manufacturing_year: number | null
          model: string
          oem_invoice_date: string | null
          place: string | null
          sc_name: string | null
          seating: string | null
          source: string
          stage: string
          status: string
          updated_at: string
          updated_by: string | null
          retail_date: string | null
          retailed_by: string | null
          variant: string | null
        }
        Insert: {
          chassis_number: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          department: string
          engine_number?: string | null
          excel_number?: string | null
          id?: string
          imported_at?: string | null
          manufacturing_year?: number | null
          model: string
          oem_invoice_date?: string | null
          place?: string | null
          sc_name?: string | null
          seating?: string | null
          source?: string
          stage?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          retail_date?: string | null
          retailed_by?: string | null
          variant?: string | null
        }
        Update: {
          chassis_number?: string
          colour?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          department?: string
          engine_number?: string | null
          excel_number?: string | null
          id?: string
          imported_at?: string | null
          manufacturing_year?: number | null
          model?: string
          oem_invoice_date?: string | null
          place?: string | null
          sc_name?: string | null
          seating?: string | null
          source?: string
          stage?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          retail_date?: string | null
          retailed_by?: string | null
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicles_retailed_by_fkey"
            columns: ["retailed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },

        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_super_admin: { Args: { p_user_id: string }; Returns: undefined }
      has_permission: {
        Args: {
          p_action: Database["public"]["Enums"]["app_action"]
          p_module: Database["public"]["Enums"]["app_module"]
        }
        Returns: boolean
      }
      increment_quotation_print_count: {
        Args: { p_quotation_id: string }
        Returns: number
      }
      is_super_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: Database["public"]["Enums"]["app_action"]
          p_details?: Json
          p_label: string
          p_module: Database["public"]["Enums"]["app_module"]
          p_record_id?: string
          p_record_type?: string
        }
        Returns: number
      }
      next_quote_number: { Args: never; Returns: string }
    }
    Enums: {
      app_action:
        | "view"
        | "create"
        | "edit"
        | "delete"
        | "approve"
        | "manage_users"
        | "export"
        | "restore"
      app_module:
        | "dashboard"
        | "stock_register"
        | "stock_hold_management"
        | "price_list_management"
        | "quotation_management"
        | "employee_management"
        | "common_excel_upload"
        | "backup_restore"
        | "audit_history"
        | "retail_reports"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_action: [
        "view",
        "create",
        "edit",
        "delete",
        "approve",
        "manage_users",
        "export",
        "restore",
      ],
      app_module: [
        "dashboard",
        "stock_register",
        "stock_hold_management",
        "price_list_management",
        "quotation_management",
        "employee_management",
        "common_excel_upload",
        "backup_restore",
        "audit_history",
        "retail_reports",
      ],
    },
  },
} as const
