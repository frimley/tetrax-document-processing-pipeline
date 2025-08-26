CREATE TABLE companies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    s3_bucket_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_id UUID NOT NULL,
    s3_prefix VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);


CREATE TABLE files (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    project_id UUID NOT NULL,
    s3_object_key VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- add an index on the project_id and sha256_checksum columns for faster lookups
CREATE INDEX idx_files_project_id_sha256_checksum ON files (project_id, sha256_checksum);

-- INSERT some test data
INSERT INTO companies (id, name, s3_bucket_name) VALUES ('123e4567-e89b-12d3-a456-426614174000', 'Test Company', 'test-company-bucket');
INSERT INTO projects (id, name, company_id, s3_prefix) VALUES ('123e4567-e89b-12d3-a456-426614174001', 'Test Project', '123e4567-e89b-12d3-a456-426614174000', 'test-prefix');
INSERT INTO users (id, name, email, password, company_id) VALUES ('123e4567-e89b-12d3-a456-426614174002', 'Test User', 'test@test.com', 'test', '123e4567-e89b-12d3-a456-426614174000');