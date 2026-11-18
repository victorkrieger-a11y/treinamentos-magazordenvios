
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "attention_score": number,"default_due_days": number,"default_max_attempts": number,"id": number,"min_answers_for_diagnosis": number,"passing_score": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attention_score"?: number,"default_due_days"?: number,"default_max_attempts"?: number,"id"?: number,"min_answers_for_diagnosis"?: number,"passing_score"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "attention_score"?: number,"default_due_days"?: number,"default_max_attempts"?: number,"id"?: number,"min_answers_for_diagnosis"?: number,"passing_score"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"attempt_answers": {
                  Row: {
                    "answered_at": string | null,"attempt_id": string,"category_id": string,"id": string,"is_correct": boolean | null,"option_order": (string)[],"position": number,"question_id": string,"quiz_question_id": string,"selected_option_id": string | null,"topic": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"attempt_id": string,"category_id": string,"id"?: string,"is_correct"?: boolean | null,"option_order": (string)[],"position": number,"question_id": string,"quiz_question_id": string,"selected_option_id"?: string | null,"topic": string
                  }
                  Update: {
                    "answered_at"?: string | null,"attempt_id"?: string,"category_id"?: string,"id"?: string,"is_correct"?: boolean | null,"option_order"?: (string)[],"position"?: number,"question_id"?: string,"quiz_question_id"?: string,"selected_option_id"?: string | null,"topic"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempt_answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "official_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "quiz_attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_answers_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempt_answers_quiz_question_id_fkey"
      columns: ["quiz_question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"metadata": NonNullable<Json>,"subject_user_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"metadata"?: NonNullable<Json>,"subject_user_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"subject_user_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_subject_user_id_fkey"
      columns: ["subject_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"collaborator_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"collaborator_id": string,"guardian_id": string,"id": string,"unassigned_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"collaborator_id": string,"guardian_id": string,"id"?: string,"unassigned_at"?: string | null
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"collaborator_id"?: string,"guardian_id"?: string,"id"?: string,"unassigned_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaborator_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborator_assignments_collaborator_id_fkey"
      columns: ["collaborator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborator_assignments_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"entity_id": string | null,"id": string,"link": string | null,"message": string,"read_at": string | null,"title": string,"type": string,"user_id": string,"visible_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id"?: string | null,"id"?: string,"link"?: string | null,"message": string,"read_at"?: string | null,"title": string,"type": string,"user_id": string,"visible_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string | null,"id"?: string,"link"?: string | null,"message"?: string,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string,"visible_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"email": string,"full_name": string,"id": string,"job_title": string | null,"last_access_at": string | null,"role": Database["public"]['Enums']["user_role"],"started_at": string | null,"status": Database["public"]['Enums']["user_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"email": string,"full_name": string,"id": string,"job_title"?: string | null,"last_access_at"?: string | null,"role": Database["public"]['Enums']["user_role"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"job_title"?: string | null,"last_access_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"started_at"?: string | null,"status"?: Database["public"]['Enums']["user_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"question_options": {
                  Row: {
                    "explanation": string | null,"id": string,"is_correct": boolean,"option_label": string,"option_text": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "explanation"?: string | null,"id"?: string,"is_correct"?: boolean,"option_label": string,"option_text": string,"question_id": string
                  }
                  Update: {
                    "explanation"?: string | null,"id"?: string,"is_correct"?: boolean,"option_label"?: string,"option_text"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_options_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "category_id": string,"code": string | null,"created_at": string,"created_by": string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"explanation": string,"id": string,"in_standard_set": boolean,"is_active": boolean,"statement": string,"study_tip": string | null,"topic": string,"updated_at": string,"updated_by": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id": string,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty": Database["public"]['Enums']["question_difficulty"],"explanation": string,"id"?: string,"in_standard_set"?: boolean,"is_active"?: boolean,"statement": string,"study_tip"?: string | null,"topic": string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Update: {
                    "category_id"?: string,"code"?: string | null,"created_at"?: string,"created_by"?: string | null,"difficulty"?: Database["public"]['Enums']["question_difficulty"],"explanation"?: string,"id"?: string,"in_standard_set"?: boolean,"is_active"?: boolean,"statement"?: string,"study_tip"?: string | null,"topic"?: string,"updated_at"?: string,"updated_by"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "questions_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_assignments": {
                  Row: {
                    "assigned_at": string,"assigned_by": string,"cancelled_at": string | null,"collaborator_id": string,"completed_at": string | null,"due_at": string | null,"id": string,"quiz_id": string,"status": Database["public"]['Enums']["assignment_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_at"?: string,"assigned_by": string,"cancelled_at"?: string | null,"collaborator_id": string,"completed_at"?: string | null,"due_at"?: string | null,"id"?: string,"quiz_id": string,"status"?: Database["public"]['Enums']["assignment_status"]
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string,"cancelled_at"?: string | null,"collaborator_id"?: string,"completed_at"?: string | null,"due_at"?: string | null,"id"?: string,"quiz_id"?: string,"status"?: Database["public"]['Enums']["assignment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_assignments_collaborator_id_fkey"
      columns: ["collaborator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_assignments_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_attempts": {
                  Row: {
                    "assignment_id": string,"attempt_number": number,"collaborator_id": string,"completed_at": string | null,"correct_answers": number | null,"duration_seconds": number | null,"finalized_reason": string | null,"id": string,"incorrect_answers": number | null,"score": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"],"total_questions": number,"unanswered": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"attempt_number": number,"collaborator_id": string,"completed_at"?: string | null,"correct_answers"?: number | null,"duration_seconds"?: number | null,"finalized_reason"?: string | null,"id"?: string,"incorrect_answers"?: number | null,"score"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"total_questions": number,"unanswered"?: number | null
                  }
                  Update: {
                    "assignment_id"?: string,"attempt_number"?: number,"collaborator_id"?: string,"completed_at"?: string | null,"correct_answers"?: number | null,"duration_seconds"?: number | null,"finalized_reason"?: string | null,"id"?: string,"incorrect_answers"?: number | null,"score"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["attempt_status"],"total_questions"?: number,"unanswered"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_attempts_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "quiz_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_collaborator_id_fkey"
      columns: ["collaborator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "id": string,"points": number,"question_id": string,"question_order": number,"question_version": number,"quiz_id": string,"snapshot": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"points"?: number,"question_id": string,"question_order": number,"question_version": number,"quiz_id": string,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "id"?: string,"points"?: number,"question_id"?: string,"question_order"?: number,"question_version"?: number,"quiz_id"?: string,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_questions_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    }
                  ]
                },"quizzes": {
                  Row: {
                    "allow_incomplete": boolean,"available_from": string,"cancelled_at": string | null,"created_at": string,"created_by": string,"deadline": string | null,"description": string | null,"id": string,"max_attempts": number,"passing_score": number,"question_count": number,"quiz_mode": Database["public"]['Enums']["quiz_mode"],"selection": NonNullable<Json>,"show_feedback": boolean,"status": Database["public"]['Enums']["quiz_status"],"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_incomplete"?: boolean,"available_from"?: string,"cancelled_at"?: string | null,"created_at"?: string,"created_by": string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"max_attempts"?: number,"passing_score": number,"question_count": number,"quiz_mode": Database["public"]['Enums']["quiz_mode"],"selection"?: NonNullable<Json>,"show_feedback"?: boolean,"status"?: Database["public"]['Enums']["quiz_status"],"title": string
                  }
                  Update: {
                    "allow_incomplete"?: boolean,"available_from"?: string,"cancelled_at"?: string | null,"created_at"?: string,"created_by"?: string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"max_attempts"?: number,"passing_score"?: number,"question_count"?: number,"quiz_mode"?: Database["public"]['Enums']["quiz_mode"],"selection"?: NonNullable<Json>,"show_feedback"?: boolean,"status"?: Database["public"]['Enums']["quiz_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quizzes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "official_attempts": {
                  Row: {
                    "assignment_id": string,"attempt_number": number,"collaborator_id": string,"completed_at": string | null,"correct_answers": number | null,"duration_seconds": number | null,"finalized_reason": string | null,"id": string,"incorrect_answers": number | null,"quiz_id": string,"score": number | null,"started_at": string,"status": Database["public"]['Enums']["attempt_status"],"total_questions": number,"unanswered": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "quiz_assignments_quiz_id_fkey"
      columns: ["quiz_id"]
isOneToOne: false
      referencedRelation: "quizzes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "quiz_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_attempts_collaborator_id_fkey"
      columns: ["collaborator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_update_profile":
{ Args: { "p": Json,"p_id": string }; Returns: undefined
                           },
"assign_guardian":
{ Args: { "p_collaborator": string,"p_guardian": string }; Returns: undefined
                           },
"cancel_assignment":
{ Args: { "p_assignment_id": string }; Returns: undefined
                           },
"cancel_quiz":
{ Args: { "p_quiz_id": string }; Returns: number
                           },
"create_quiz":
{ Args: { "p": Json }; Returns: string
                           },
"expire_overdue":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalize_attempt":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_attempt":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_attempt_review":
{ Args: { "p_attempt_id": string }; Returns: Json
                           },
"get_reinforcement_items":
{ Args: { "p_collaborator": string }; Returns: {
              "category_id": string,"question_id": string,"statement": string,"study_tip": string,"topic": string,"total": number,"wrong": number
            }[]
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"provision_profile":
{ Args: { "p": Json }; Returns: string
                           },
"save_answer":
{ Args: { "p_answer_id": string,"p_attempt_id": string,"p_option_id": string }; Returns: string
                           },
"save_question":
{ Args: { "p": Json }; Returns: string
                           },
"set_question_active":
{ Args: { "p_active": boolean,"p_id": string }; Returns: undefined
                           },
"start_attempt":
{ Args: { "p_assignment_id": string }; Returns: string
                           },
"touch_last_access":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_status"]
                           },
"update_settings":
{ Args: { "p": Json }; Returns: undefined
                           }
          }
          Enums: {
            "assignment_status": "pending"|"in_progress"|"completed"|"expired"|"cancelled","attempt_status": "in_progress"|"completed"|"abandoned","question_difficulty": "facil"|"media"|"dificil","quiz_mode": "standard"|"custom","quiz_status": "active"|"cancelled","user_role": "supervisor"|"guardian"|"collaborator","user_status": "invited"|"active"|"inactive"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "assignment_status": ["pending", "in_progress", "completed", "expired", "cancelled"],"attempt_status": ["in_progress", "completed", "abandoned"],"question_difficulty": ["facil", "media", "dificil"],"quiz_mode": ["standard", "custom"],"quiz_status": ["active", "cancelled"],"user_role": ["supervisor", "guardian", "collaborator"],"user_status": ["invited", "active", "inactive"]
          }
        }
} as const
