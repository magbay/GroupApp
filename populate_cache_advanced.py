#!/usr/bin/env python3
"""
Populate task cache database with ADVANCED guides.
Continuously generates advanced guides for random tasks until stopped (Ctrl+C).
"""

import requests
import json
import random
import time
import sys

# Configuration
PROXY_URL = 'http://10.107.101.37:8001'
OLLAMA_TARGET = 'https://synodic-maximilian-feudally.ngrok-free.dev'  # Ollama endpoint to use
TASK_FILES = ['ccna.txt', 'linux.txt', 'sysadmin.txt', 'hacking.txt', 'python.txt', 'javascript.txt', 'ai.txt']
MODEL_NAME = 'gpt-oss:20b'  # Update if using different model
IS_ADVANCED = True  # Advanced mode

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
    """Generate an ADVANCED guide for the task using Ollama."""
    prompt = f"""You are an expert-level technical documentation specialist and security professional. Create a comprehensive, ADVANCED KB (Knowledge Base) article to help complete the task below. This guide should be TWICE the length of a standard guide and include expert-level knowledge, security considerations, advanced techniques, and deep technical details.

Format your response EXACTLY like this structure:
## Overview
[Comprehensive 3-4 sentence summary covering the technical context, security implications, and what will be accomplished]

## Prerequisites
- [Detailed list of required tools with specific versions]
- [Required permissions and access levels]
- [Advanced knowledge requirements and technical background needed]
- [Security considerations before starting]

## Technical Background
[2-3 paragraphs explaining the underlying technology, protocols, or concepts involved at an expert level]

## Steps
### Step 1: [Detailed Action Title]
[In-depth instruction with technical reasoning, security implications, and best practices]
**Security Note:** [Security considerations for this step]
**Advanced Tip:** [Expert-level optimization or alternative approach]

### Step 2: [Detailed Action Title]
[In-depth instruction with technical reasoning, security implications, and best practices]
**Security Note:** [Security considerations for this step]
**Advanced Tip:** [Expert-level optimization or alternative approach]

[Continue with 20-30 detailed steps as needed for comprehensive coverage]

## Verification and Validation
### Verification Steps
[Detailed steps to confirm successful completion]

### Troubleshooting Common Issues
[List potential problems and expert-level solutions]

### Performance Optimization
[How to optimize the implementation]

## Security Hardening
[Additional security measures and hardening techniques specific to this task]

## Advanced Scenarios
[Complex use cases and edge cases with solutions]

## Additional Resources
- [Links to advanced documentation, RFCs, or technical papers]
- [Industry best practices and compliance standards]
- [Advanced tutorials and expert-level resources]

## Expert Notes
[Additional insights, caveats, or advanced considerations that experts should know]

Task: {task['name']}
Task details: {task['description']}

Make this guide comprehensive and detailed (20-30+ steps). Include detailed command examples with explanations, configuration files, security best practices, and advanced techniques throughout."""

    try:
        print(f"  Generating ADVANCED guide...", end='', flush=True)
        
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
            timeout=300  # Longer timeout for advanced guides
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
    print("Task Cache Populator - ADVANCED MODE")
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
    
    print("\nStarting ADVANCED generation... (Press Ctrl+C to stop)")
    print("⚠️  Advanced guides take longer to generate (2-5x normal)")
    print("-" * 70)
    
    generated_count = 0
    skipped_count = 0
    
    try:
        while True:
            # Pick a random task
            task = random.choice(all_tasks)
            
            print(f"\n[{generated_count + skipped_count + 1}] {task['file']} -> {task['name']} [ADVANCED]")
            
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
                
                # Show stats every 3 generations (less frequent due to longer generation time)
                if generated_count % 3 == 0:
                    stats = get_cache_stats()
                    if stats:
                        print(f"\n  📊 Cache stats: {stats['total_guides']} total, {stats['normal_guides']} normal, {stats['advanced_guides']} advanced\n")
            
            # Small delay between requests
            time.sleep(3)
    
    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("Stopped by user")
        print(f"Generated: {generated_count} new ADVANCED guides")
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
