/**
 * Hand-maintained Supabase schema types.
 *
 * Kept in the same shape `supabase gen types typescript` produces, so it can be
 * swapped for generated output later without touching call sites. It is written
 * by hand here because the schema is small and the Supabase CLI was not
 * available in the build environment.
 *
 * Source of truth is always supabase/migrations/*.sql.
 */

export type UserRole = "admin" | "customer";

export type JobStatus = "draft" | "open" | "closed";

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary";

export type PipelineStage =
  | "new"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

type Timestamp = string;

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string;
          role: UserRole;
          created_at: Timestamp;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name: string;
          role: UserRole;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          full_name?: string;
          role?: UserRole;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          location: string | null;
          employment_type: EmploymentType | null;
          status: JobStatus;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          location?: string | null;
          employment_type?: EmploymentType | null;
          status?: JobStatus;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          description?: string | null;
          location?: string | null;
          employment_type?: EmploymentType | null;
          status?: JobStatus;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      candidates: {
        Row: {
          id: string;
          organization_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          linkedin_url: string | null;
          location: string | null;
          cv_text: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          organization_id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          cv_text?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          organization_id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          linkedin_url?: string | null;
          location?: string | null;
          cv_text?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          organization_id: string;
          candidate_id: string;
          job_id: string;
          stage: PipelineStage;
          notes: string | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          organization_id: string;
          candidate_id: string;
          job_id: string;
          stage?: PipelineStage;
          notes?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          organization_id?: string;
          candidate_id?: string;
          job_id?: string;
          stage?: PipelineStage;
          notes?: string | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
      candidate_assessments: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          match_score: number;
          summary: string;
          strengths: string[];
          gaps: string[];
          interview_questions: string[];
          model: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          match_score: number;
          summary: string;
          strengths?: string[];
          gaps?: string[];
          interview_questions?: string[];
          model?: string | null;
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          organization_id?: string;
          application_id?: string;
          match_score?: number;
          summary?: string;
          strengths?: string[];
          gaps?: string[];
          interview_questions?: string[];
          model?: string | null;
          created_at?: Timestamp;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      tf_role: {
        Args: Record<never, never>;
        Returns: string;
      };
      tf_org_id: {
        Args: Record<never, never>;
        Returns: string | null;
      };
      tf_is_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type CandidateAssessment =
  Database["public"]["Tables"]["candidate_assessments"]["Row"];
