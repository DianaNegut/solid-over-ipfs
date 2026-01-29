-- Initialize database schema for Solid Community Server Identity Management
-- This stores accounts, logins, WebIDs, tokens, and cookies

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing account data
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_account_id ON accounts(account_id);
CREATE INDEX idx_accounts_data ON accounts USING gin(data);

-- Table for storing account index (for quick lookups)
CREATE TABLE IF NOT EXISTS account_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    index_key VARCHAR(255) UNIQUE NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_account_index_key ON account_index(index_key);
CREATE INDEX idx_account_index_account_id ON account_index(account_id);

-- Table for storing cookies
CREATE TABLE IF NOT EXISTS cookies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cookie_id VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cookies_cookie_id ON cookies(cookie_id);
CREATE INDEX idx_cookies_expires_at ON cookies(expires_at);

-- Table for storing OIDC client registrations
CREATE TABLE IF NOT EXISTS oidc_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret VARCHAR(255),
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oidc_clients_client_id ON oidc_clients(client_id);

-- Table for storing OIDC grants and sessions
CREATE TABLE IF NOT EXISTS oidc_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_key VARCHAR(512) UNIQUE NOT NULL,
    storage_type VARCHAR(50) NOT NULL, -- 'Session', 'Grant', 'AccessToken', etc.
    data JSONB NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oidc_storage_key ON oidc_storage(storage_key);
CREATE INDEX idx_oidc_storage_type ON oidc_storage(storage_type);
CREATE INDEX idx_oidc_storage_expires ON oidc_storage(expires_at);

-- Function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oidc_clients_updated_at BEFORE UPDATE ON oidc_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oidc_storage_updated_at BEFORE UPDATE ON oidc_storage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired cookies and OIDC storage
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    DELETE FROM cookies WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    DELETE FROM oidc_storage WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ language 'plpgsql';

-- Grant permissions to solid_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO solid_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO solid_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO solid_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Solid Community Server database initialized successfully';
END $$;
