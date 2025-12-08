#!/usr/bin/env python3
"""
Populate task cache database with normal (non-advanced) guides.
Continuously generates guides for random tasks until stopped (Ctrl+C).
"""

import requests
import json
import random
import time
import sys

# Configuration
PROXY_URL = 'http://10.207.20.29:8001'
OLLAMA_TARGET = 'https://synodic-maximilian-feudally.ngrok-free.dev'  # Ollama endpoint to use
TASK_FILES = ['ccna.txt', 'linux.txt', 'sysadmin.txt', 'hacking.txt', 'python.txt', 'javascript.txt', 'ai.txt']
MODEL_NAME = 'deepseek-r1:32b'  # Update if using different model
IS_ADVANCED = False  # Normal mode

def load_tasks_from_file(filename):
    """Load tasks from a text file."""
    try:
        with open(filename, 'r') as f:
            lines = f.readlines()
        
        tasks = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if ':' in line:
                parts = line.split(':', 1)
                task_name = parts[0].strip()
                task_description = parts[1].strip() if len(parts) > 1 else ''
                tasks.append({
                    'name': task_name,
                    'description': task_description,
                    'file': filename
                })
        
        return tasks
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []

def check_cache(task_name, task_description):
    """Check if task guide already exists in cache."""
    try:
        response = requests.post(
            f'{PROXY_URL}/api/cache/get',
            json={
                'task_name': task_name,
                'task_description': task_description,
                'is_advanced': IS_ADVANCED,
                'model_name': MODEL_NAME
            },
            timeout=5
        )
        
        if response.ok:
            data = response.json()
            return data.get('found', False)
        return False
    except Exception as e:
        print(f"Error checking cache: {e}")
        return False

def generate_guide(task):
    """Generate a guide for the task using Ollama."""
    prompt = f"""You are a technical documentation expert. Create a step-by-step KB (Knowledge Base) article to help complete the task below.

Format your response EXACTLY like this structure:
## Overview
[Brief 1-2 sentence summary of what will be accomplished]

## Prerequisites
- [List any required tools, access, or knowledge]

## Steps
### Step 1: [Action Title]
[Clear instruction on what to do]

### Step 2: [Action Title]
[Clear instruction on what to do]

[Continue with numbered steps as needed]

## Verification
[How to confirm the task was completed successfully]

## Additional Resources
- [Link to documentation or tutorial if applicable]

Task: {task['name']}
Task details: {task['description']}

Keep it concise (10-15 steps maximum). Include command examples in code blocks where relevant."""

    try:
        print(f"  Generating guide...", end='', flush=True)
        
        # Send request to Ollama through proxy with target header
        response = requests.post(
            f'{PROXY_URL}/api/generate',
            headers={
                'X-Ollama-Target': OLLAMA_TARGET,
                'Content-Type': 'application/json'
            },
            json={
                'model': MODEL_NAME,
                'prompt': prompt,
                'stream': True
            },
            stream=True,
            timeout=120
        )
        
        if not response.ok:
            print(f" FAILED (HTTP {response.status_code})")
            return None
        
        # Collect streamed response
        full_text = ''
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    if 'response' in data:
                        full_text += data['response']
                        # Show progress
                        if len(full_text) % 100 == 0:
                            print('.', end='', flush=True)
                except json.JSONDecodeError:
                    pass
        
        # Remove thinking tags
        full_text = full_text.replace('<think>', '').replace('</think>', '').strip()
        
        print(f" ✓ ({len(full_text)} chars)")
        return full_text
        
    except requests.exceptions.Timeout:
        print(" TIMEOUT")
        return None
    except Exception as e:
        print(f" ERROR: {e}")
        return None

def save_to_cache(task, guide_content):
    """Save generated guide to cache."""
    try:
        response = requests.post(
            f'{PROXY_URL}/api/cache/save',
            json={
                'task_name': task['name'],
                'task_description': task['description'],
                'is_advanced': IS_ADVANCED,
                'model_name': MODEL_NAME,
                'guide_content': guide_content
            },
            timeout=5
        )
        
        if response.ok:
            print(f"  Saved to cache ✓")
            return True
        else:
            print(f"  Failed to save to cache (HTTP {response.status_code})")
            return False
    except Exception as e:
        print(f"  Error saving to cache: {e}")
        return False

def get_cache_stats():
    """Get current cache statistics."""
    try:
        response = requests.get(f'{PROXY_URL}/api/cache/stats', timeout=5)
        if response.ok:
            return response.json()
        return None
    except:
        return None

def main():
    print("=" * 70)
    print("Task Cache Populator - NORMAL MODE")
    print("=" * 70)
    print(f"Model: {MODEL_NAME}")
    print(f"Advanced: {IS_ADVANCED}")
    print(f"Proxy: {PROXY_URL}")
    print()
    
    # Load all tasks
    print("Loading tasks from files...")
    all_tasks = []
    for filename in TASK_FILES:
        tasks = load_tasks_from_file(filename)
        all_tasks.extend(tasks)
        print(f"  {filename}: {len(tasks)} tasks")
    
    print(f"\nTotal tasks available: {len(all_tasks)}")
    
    if not all_tasks:
        print("ERROR: No tasks loaded!")
        return 1
    
    # Get initial stats
    stats = get_cache_stats()
    if stats:
        print(f"Current cache: {stats['total_guides']} guides ({stats['normal_guides']} normal, {stats['advanced_guides']} advanced)")
    
    print("\nStarting generation... (Press Ctrl+C to stop)")
    print("-" * 70)
    
    generated_count = 0
    skipped_count = 0
    
    try:
        while True:
            # Pick a random task
            task = random.choice(all_tasks)
            
            print(f"\n[{generated_count + skipped_count + 1}] {task['file']} -> {task['name']}")
            
            # Check if already cached
            if check_cache(task['name'], task['description']):
                print("  Already cached, skipping ⊘")
                skipped_count += 1
                time.sleep(0.5)  # Brief pause
                continue
            
            # Generate guide
            guide = generate_guide(task)
            
            if guide:
                # Save to cache
                if save_to_cache(task, guide):
                    generated_count += 1
                
                # Show stats every 5 generations
                if generated_count % 5 == 0:
                    stats = get_cache_stats()
                    if stats:
                        print(f"\n  📊 Cache stats: {stats['total_guides']} total, {stats['normal_guides']} normal, {stats['advanced_guides']} advanced\n")
            
            # Small delay between requests
            time.sleep(2)
    
    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("Stopped by user")
        print(f"Generated: {generated_count} new guides")
        print(f"Skipped: {skipped_count} already cached")
        
        # Final stats
        stats = get_cache_stats()
        if stats:
            print(f"\nFinal cache: {stats['total_guides']} guides ({stats['normal_guides']} normal, {stats['advanced_guides']} advanced)")
        print("=" * 70)
        return 0
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
