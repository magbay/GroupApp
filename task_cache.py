"""
SQLite database for caching Ollama task guide responses.
Stores both normal and advanced versions of guides.
"""
import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'task_cache.db')

def init_db():
    """Initialize the database with required tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_guides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            task_description TEXT NOT NULL,
            is_advanced BOOLEAN NOT NULL DEFAULT 0,
            model_name TEXT NOT NULL,
            guide_content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(task_name, task_description, is_advanced, model_name)
        )
    ''')
    
    # Index for faster lookups
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_task_lookup 
        ON task_guides(task_name, task_description, is_advanced, model_name)
    ''')
    
    conn.commit()
    conn.close()

def get_cached_guide(task_name, task_description, is_advanced, model_name):
    """
    Retrieve a cached guide from the database.
    Returns: (guide_content, created_at) tuple or None if not found
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT guide_content, created_at 
        FROM task_guides 
        WHERE task_name = ? 
        AND task_description = ? 
        AND is_advanced = ?
        AND model_name = ?
    ''', (task_name, task_description, int(is_advanced), model_name))
    
    result = cursor.fetchone()
    conn.close()
    
    return result if result else None

def save_guide(task_name, task_description, is_advanced, model_name, guide_content):
    """
    Save or update a guide in the database.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO task_guides (task_name, task_description, is_advanced, model_name, guide_content, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(task_name, task_description, is_advanced, model_name) 
        DO UPDATE SET 
            guide_content = excluded.guide_content,
            updated_at = CURRENT_TIMESTAMP
    ''', (task_name, task_description, int(is_advanced), model_name, guide_content))
    
    conn.commit()
    conn.close()

def delete_guide(task_name, task_description, is_advanced, model_name):
    """
    Delete a specific guide from the cache.
    Used when regenerating a guide.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM task_guides 
        WHERE task_name = ? 
        AND task_description = ? 
        AND is_advanced = ?
        AND model_name = ?
    ''', (task_name, task_description, int(is_advanced), model_name))
    
    conn.commit()
    conn.close()

def get_cache_stats():
    """Get statistics about the cache."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM task_guides')
    total = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM task_guides WHERE is_advanced = 1')
    advanced = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        'total_guides': total,
        'normal_guides': total - advanced,
        'advanced_guides': advanced
    }

# Initialize database on import
init_db()
