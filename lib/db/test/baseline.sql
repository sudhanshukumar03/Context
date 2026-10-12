-- Minimal pre-001 schema used only by an isolated disposable PostgreSQL test.
CREATE TABLE organizations (id serial PRIMARY KEY, name text NOT NULL, slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (id serial PRIMARY KEY, clerk_user_id text UNIQUE, organization_id integer REFERENCES organizations(id),
  email text NOT NULL UNIQUE, name text NOT NULL, role text NOT NULL DEFAULT 'backend', password_hash text NOT NULL DEFAULT 'clerk-managed', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE services (id serial PRIMARY KEY, organization_id integer REFERENCES organizations(id), name text NOT NULL,
  description text, status text NOT NULL DEFAULT 'healthy', owner_team text, criticality text NOT NULL DEFAULT 'medium', metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE service_events (id serial PRIMARY KEY, organization_id integer REFERENCES organizations(id), service_id integer REFERENCES services(id),
  type text NOT NULL DEFAULT 'info', title text NOT NULL, description text, severity text NOT NULL DEFAULT 'info', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE context_briefs (id serial PRIMARY KEY, organization_id integer NOT NULL REFERENCES organizations(id),
  user_id integer NOT NULL REFERENCES users(id), role text NOT NULL DEFAULT 'backend', status text NOT NULL DEFAULT 'pending', data text, job_id text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
