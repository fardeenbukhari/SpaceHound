-- Clearner Signature Database Schema
-- SQLite database for app signature matching

-- Main app signatures table
CREATE TABLE IF NOT EXISTS app_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL,
  category TEXT NOT NULL,
  publisher TEXT,
  is_regenerable BOOLEAN DEFAULT 0,
  base_risk_level TEXT DEFAULT 'review',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Path patterns for matching folders
CREATE TABLE IF NOT EXISTS path_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_signature_id INTEGER NOT NULL,
  pattern TEXT NOT NULL,
  priority INTEGER DEFAULT 50,
  FOREIGN KEY (app_signature_id) REFERENCES app_signatures(id) ON DELETE CASCADE
);

-- File markers for identification
CREATE TABLE IF NOT EXISTS file_markers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_signature_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  is_required BOOLEAN DEFAULT 0,
  FOREIGN KEY (app_signature_id) REFERENCES app_signatures(id) ON DELETE CASCADE
);

-- Folder type classifications
CREATE TABLE IF NOT EXISTS folder_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_signature_id INTEGER NOT NULL,
  folder_type TEXT NOT NULL,
  path_pattern TEXT NOT NULL,
  is_safe_to_delete BOOLEAN DEFAULT 0,
  is_regenerable BOOLEAN DEFAULT 0,
  explanation TEXT,
  FOREIGN KEY (app_signature_id) REFERENCES app_signatures(id) ON DELETE CASCADE
);

-- Exclusion patterns (never delete)
CREATE TABLE IF NOT EXISTS exclusion_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  severity TEXT DEFAULT 'critical'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_path_patterns_app ON path_patterns(app_signature_id);
CREATE INDEX IF NOT EXISTS idx_file_markers_app ON file_markers(app_signature_id);
CREATE INDEX IF NOT EXISTS idx_folder_types_app ON folder_types(app_signature_id);
CREATE INDEX IF NOT EXISTS idx_app_category ON app_signatures(category);

-- Track database version
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO metadata (key, value) VALUES ('schema_version', '1.0.0');
INSERT INTO metadata (key, value) VALUES ('created_at', datetime('now'));

-- ============================================================================
-- PROTECTED SYSTEM PATHS
-- ============================================================================

INSERT INTO exclusion_patterns (pattern, reason, severity) VALUES
  ('C:\Windows\**', 'Windows system files', 'critical'),
  ('C:\Program Files\WindowsApps\**', 'Windows Store apps', 'critical'),
  ('C:\ProgramData\Microsoft\Windows\**', 'Windows system data', 'critical'),
  ('C:\$Recycle.Bin\**', 'Windows Recycle Bin', 'critical'),
  ('C:\System Volume Information\**', 'System restore points', 'critical'),
  ('C:\Users\*\Documents\**', 'User documents', 'warning'),
  ('C:\Users\*\Pictures\**', 'User photos', 'warning'),
  ('C:\Users\*\Videos\**', 'User videos', 'warning');

-- ============================================================================
-- APP SIGNATURES
-- ============================================================================

-- Unreal Engine
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (1, 'Unreal Engine', 'game_engine', 'Epic Games', 1, 'review', 'Game development engine');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (1, '**/UnrealEngine/**', 70),
  (1, '**/Epic Games/UE_*/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (1, 'cache', '**/DerivedDataCache/**', 1, 1, 'Shader cache - regenerated automatically'),
  (1, 'build', '**/Intermediate/**', 1, 1, 'Build artifacts - regenerated on compile'),
  (1, 'logs', '**/Saved/Logs/**', 1, 0, 'Editor logs - safe to delete'),
  (1, 'projects', '**/Content/**', 0, 0, 'User project files - contains your work');

-- Unity
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (2, 'Unity', 'game_engine', 'Unity Technologies', 1, 'review', 'Game development platform');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (2, '**/Unity/**', 70);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (2, 'cache', '**/Library/ShaderCache/**', 1, 1, 'Shader cache - regenerated automatically'),
  (2, 'build', '**/Temp/**', 1, 1, 'Temporary build files'),
  (2, 'projects', '**/Assets/**', 0, 0, 'Project assets - contains your game content');

-- Steam
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (3, 'Steam', 'game_platform', 'Valve', 1, 'review', 'PC gaming platform');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (3, '**/Steam/**', 60),
  (3, '**/steamapps/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (3, 'cache', '**/steamapps/shadercache/**', 1, 1, 'Shader cache - games rebuild on launch'),
  (3, 'logs', '**/logs/**', 1, 0, 'Steam logs - safe to delete');

-- Visual Studio
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (4, 'Visual Studio', 'ide', 'Microsoft', 1, 'review', 'Development IDE');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (4, '**/Visual Studio/**', 70),
  (4, '**/.vs/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (4, 'cache', '**/.vs/**', 1, 1, 'VS cache - regenerated per project'),
  (4, 'build', '**/bin/**', 1, 1, 'Compiled binaries - regenerated on build'),
  (4, 'build', '**/obj/**', 1, 1, 'Object files - regenerated on build');

-- Node.js
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (5, 'Node.js', 'dev_tools', 'OpenJS Foundation', 1, 'safe', 'JavaScript runtime');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (5, '**/node_modules/**', 90),
  (5, '**/npm/cache/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (5, 'cache', '**/node_modules/**', 1, 1, 'Installed packages - run npm install to restore'),
  (5, 'cache', '**/npm/cache/**', 1, 1, 'npm cache - regenerated as needed');

-- Python
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (6, 'Python', 'dev_tools', 'Python Software Foundation', 1, 'safe', 'Python language');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (6, '**/__pycache__/**', 90),
  (6, '**/pip/cache/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (6, 'cache', '**/__pycache__/**', 1, 1, 'Python bytecode cache - regenerated automatically'),
  (6, 'cache', '**/pip/cache/**', 1, 1, 'pip cache - safe to delete');

-- Chrome
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (7, 'Google Chrome', 'browser', 'Google', 1, 'safe', 'Web browser');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (7, '**/Google/Chrome/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (7, 'cache', '**/Cache/**', 1, 1, 'Browser cache - regenerated as you browse'),
  (7, 'cache', '**/Code Cache/**', 1, 1, 'JavaScript cache - regenerated automatically');

-- Edge
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (8, 'Microsoft Edge', 'browser', 'Microsoft', 1, 'safe', 'Web browser');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (8, '**/Microsoft/Edge/**', 80);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (8, 'cache', '**/Cache/**', 1, 1, 'Browser cache - regenerated as you browse');

-- Windows Temp
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (9, 'Windows Temp', 'system', 'Microsoft', 1, 'safe', 'Temporary files');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (9, '**/AppData/Local/Temp/**', 90);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (9, 'temp', '**/Temp/**', 1, 1, 'Temporary files - safe to delete when apps are closed');

-- GPU Shader Cache
INSERT INTO app_signatures (id, app_name, category, publisher, is_regenerable, base_risk_level, description)
VALUES (10, 'GPU Shader Cache', 'system', 'Various', 1, 'safe', 'Graphics shader cache');

INSERT INTO path_patterns (app_signature_id, pattern, priority) VALUES
  (10, '**/NVIDIA/GLCache/**', 90),
  (10, '**/AMD/GLCache/**', 90);

INSERT INTO folder_types (app_signature_id, folder_type, path_pattern, is_safe_to_delete, is_regenerable, explanation) VALUES
  (10, 'cache', '**/GLCache/**', 1, 1, 'GPU shader cache - games rebuild on launch');

UPDATE metadata SET value = (SELECT COUNT(*) FROM app_signatures) WHERE key = 'signature_count';
