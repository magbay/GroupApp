#!/usr/bin/env python3
"""
Populate task cache database with project guides.
Continuously generates guides for random projects until stopped (Ctrl+C).
"""

import requests
import json
import random
import time
import sys

# Configuration
PROXY_URL = 'http://10.207.20.29:8001'
OLLAMA_TARGET = 'https://synodic-maximilian-feudally.ngrok-free.dev'  # Ollama endpoint to use
PROJECT_FILE = 'projects.txt'
MODEL_NAME = 'ministral-3'  # Update if using different model
IS_ADVANCED = False  # Normal mode
IS_PROJECT = True  # This is for projects

def load_projects_from_file(filename):
    """Load projects from a text file."""
    try:
        with open(filename, 'r') as f:
            lines = f.readlines()
        
        projects = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if ':' in line:
                parts = line.split(':', 1)
                project_name = parts[0].strip()
                project_description = parts[1].strip() if len(parts) > 1 else ''
                projects.append({
                    'name': project_name,
                    'description': project_description
                })
        
        return projects
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []

def check_cache(project_name, project_description):
    """Check if project guide already exists in cache."""
    try:
        response = requests.post(
            f'{PROXY_URL}/api/cache/get',
            json={
                'task_name': project_name,
                'task_description': project_description,
                'is_advanced': IS_ADVANCED,
                'model_name': MODEL_NAME,
                'is_project': IS_PROJECT
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

def generate_project_guide(project):
    """Generate a guide for the project using Ollama."""
    prompt = f"""You are a professional technical writer creating an in-depth, engaging tutorial guide in the style of popular Medium articles. Write in a conversational yet authoritative tone, using personal pronouns (you, we, I), storytelling elements, and practical examples. Make the content engaging, accessible, and comprehensive.

Format your response EXACTLY like this structure:

# {project['name']}: A Complete Guide

## Introduction

Hey there! Today we're going to dive deep into {project['name']}. Whether you're just getting started or looking to strengthen your understanding, this guide will walk you through everything you need to know.

**What we'll cover in this guide:**
- [Key topic 1]
- [Key topic 2]
- [Key topic 3]
- [Continue with 5-8 main topics]

**By the end of this tutorial, you'll be able to:**
- [Specific outcome 1]
- [Specific outcome 2]
- [Continue with 5-7 outcomes]

**Time to complete:** [Estimated time]
**Difficulty level:** [Beginner/Intermediate/Advanced]

---

## Why This Matters

Before we jump into the technical details, let's talk about why you should care about this.

[Write 3-4 engaging paragraphs explaining:
- The real-world problem this solves
- Why professionals use this technology
- How it fits into modern development
- The career/skill benefits of learning this]

**Real-world use case:** [Describe a concrete scenario where this is used in production]

---

## What You'll Need

Here's what you should have ready before we begin:

**Required:**
- [Tool/software 1] - [Why you need it]
- [Tool/software 2] - [Why you need it]
- [Continue...]

**Nice to have:**
- [Optional tool 1]
- [Optional tool 2]

**Knowledge prerequisites:**
You should be comfortable with [list basics]. Don't worry if you're not an expert—I'll explain everything as we go!

---

## Understanding the Fundamentals

Let's start by understanding what we're actually working with here.

### What is [Technology/Concept]?

[Write 2-3 conversational paragraphs explaining the concept in plain English, using everyday analogies]

Think of it like this: [Simple analogy that makes it relatable]

### How Does It Work?

Here's the interesting part. [Explain the underlying mechanism in 3-4 paragraphs, breaking down complexity into digestible pieces]

**The key components are:**
1. **[Component 1]** - [What it does in simple terms]
2. **[Component 2]** - [What it does in simple terms]
3. **[Component 3]** - [What it does in simple terms]

### Why We Build It This Way

You might be wondering why we don't just [alternative approach]. Good question! [Explain the reasoning behind the design choices]

---

## Let's Get Started: Part 1 - [Section Name]

Alright, enough theory—let's build something!

### Step 1: [First Action]

First things first, we need to [action description]. Here's how:

```bash
# [Command with descriptive comment]
[actual command]
```

**What's happening here?**
When you run this command, [explain what happens step by step]. The `[flag/option]` tells it to [explanation], which is important because [reason].

**You should see:**
```
[Expected output]
```

If you see something different, don't panic! [Common variation and what it means]

### Step 2: [Next Action]

Now that we've got [previous step result], let's [next action]. This is where things get interesting.

```python
# [Descriptive comment explaining what this code does]
[code example with inline comments]
```

**Let's break this down line by line:**

**Line 1:** `[code snippet]` - This [explanation]. We're using [approach] because [reason].

**Line 2:** `[code snippet]` - Here we're [explanation]. Notice how [important detail]? That's crucial because [reason].

**Line 3:** `[code snippet]` - [Continue detailed explanation]

**Pro tip:** [Helpful insight or best practice]

### Step 3: [Continue Pattern]

[Continue with detailed, conversational explanations]

[Include 8-12 major steps in Part 1]

---

## Part 2 - [Next Major Section]

Great! You've made it through the basics. Now let's level up.

### [Next Topic]

Here's where most tutorials gloss over important details, but we won't do that. Let me explain [concept] properly.

[Write detailed explanation in conversational style]

**Here's the code:**

```javascript
// [Comment explaining overall purpose]
[code with extensive inline comments explaining each important line]
```

**Wait, what's going on here?**

I know that might look confusing at first. Let me walk you through it:

1. First, we [action] - this sets up [thing]
2. Then we [action] - this is important because [reason]
3. Finally, we [action] - which gives us [result]

**Common mistake alert!** 
Many developers try to [common mistake]. Don't do this! It causes [problem] because [explanation]. Instead, always [correct approach].

[Continue with detailed sections]

---

## Part 3 - [Advanced Topic]

You're doing great! Now let's tackle something a bit more advanced.

[Continue pattern with conversational tone and detailed explanations]

[Include 15-20 major sections total across all parts]

---

## Putting It All Together: A Complete Example

Let's build a real, working example from scratch. I'll walk you through every single line.

**What we're building:** [Description of complete example]

**Here's the full code:**

```python
# [Comprehensive example with extensive comments]
[complete, working code example]
```

**Now let's understand every piece:**

[Provide detailed walkthrough of entire example, explaining how all parts work together]

**Testing it out:**

Run this with:
```bash
[command to run]
```

You should see:
```
[expected output]
```

Awesome! If you got this working, you've just successfully [achievement]. That's a big deal!

---

## Common Issues and How to Fix Them

Let me share some issues I've run into (and how I solved them).

### Problem 1: [Common Error]

**What you see:**
```
[Error message]
```

**What it means:**
[Plain English explanation of what's wrong]

**How to fix it:**
[Step-by-step solution with explanation]

**Why this happens:**
[Root cause explanation]

### Problem 2: [Another Common Issue]

[Continue pattern for 6-8 common issues]

---

## Best Practices and Pro Tips

Now that you've got the basics down, here are some tips I wish someone had told me when I was learning this:

**1. [Best Practice Title]**
[Explanation of why this matters and how to implement it]

**2. [Best Practice Title]**
[Continue with explanations]

**3. Do this, not that:**
❌ **Don't:** [Bad practice]
✅ **Do:** [Good practice]
**Why:** [Explanation]

[Include 8-10 best practices]

---

## Taking It Further

Congratulations! You've built [what they built]. But don't stop here—let's talk about what's next.

### Ideas for Enhancement

**Easy additions:**
- [Enhancement 1] - [How it improves the project]
- [Enhancement 2] - [How it improves the project]

**Intermediate challenges:**
- [Challenge 1] - [What you'll learn]
- [Challenge 2] - [What you'll learn]

**Advanced projects:**
- [Advanced idea 1] - [Skills you'll practice]
- [Advanced idea 2] - [Skills you'll practice]

### Related Topics to Explore

Now that you understand {project['name']}, you're ready to learn:
- **[Related topic 1]** - [How it connects]
- **[Related topic 2]** - [How it connects]
- **[Related topic 3]** - [How it connects]

---

## Frequently Asked Questions

**Q: [Common question]**
A: [Detailed, helpful answer]

**Q: [Another question]**
A: [Detailed, helpful answer]

[Include 8-10 FAQs]

---

## Resources and Further Reading

Want to dive deeper? Here are my favorite resources:

**Documentation:**
- [Resource 1] - [What makes it useful]
- [Resource 2] - [What makes it useful]

**Tutorials and Courses:**
- [Resource 1] - [Why I recommend it]
- [Resource 2] - [Why I recommend it]

**Community:**
- [Forum/Community 1] - [What you'll find there]
- [Forum/Community 2] - [What you'll find there]

---

## Wrapping Up

Let's recap what we've covered today:

✅ [Key learning 1]
✅ [Key learning 2]
✅ [Key learning 3]
✅ [Continue with all major learnings]

You've come a long way! When I first started with {project['name']}, I struggled with [relatable struggle]. But with practice, it becomes second nature.

**Your next steps:**
1. [Immediate next action]
2. [Follow-up practice]
3. [Advanced exploration]

Remember, the best way to learn is by doing. Take this code, break it, fix it, and make it your own.

**Got questions?** Drop them in the comments below, and I'll help you out!

**Found this helpful?** Share it with someone who's learning {project['name']}!

Happy coding! 🚀

---

*Project: {project['name']}*
*Details: {project['description']}*

Write this as an engaging, comprehensive Medium-style tutorial with a conversational tone. Use personal pronouns, storytelling, practical examples, and detailed code explanations. Include 15-20 major sections with thorough walkthroughs, common pitfalls, best practices, and actionable next steps. Make it feel like a friendly expert is teaching the reader one-on-one."""

    try:
        print(f"  Generating project guide...", end='', flush=True)
        
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
            timeout=300  # Longer timeout for project guides
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

def save_to_cache(project, guide_content):
    """Save generated project guide to cache."""
    try:
        response = requests.post(
            f'{PROXY_URL}/api/cache/save',
            json={
                'task_name': project['name'],
                'task_description': project['description'],
                'is_advanced': IS_ADVANCED,
                'model_name': MODEL_NAME,
                'guide_content': guide_content,
                'is_project': IS_PROJECT
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
    print("Project Cache Populator - MEDIUM-STYLE GUIDES")
    print("=" * 70)
    print(f"Model: {MODEL_NAME}")
    print(f"Advanced: {IS_ADVANCED}")
    print(f"Project Mode: {IS_PROJECT}")
    print(f"Proxy: {PROXY_URL}")
    print()
    
    # Load all projects
    print(f"Loading projects from {PROJECT_FILE}...")
    all_projects = load_projects_from_file(PROJECT_FILE)
    print(f"  Loaded: {len(all_projects)} projects")
    
    if not all_projects:
        print("ERROR: No projects loaded!")
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
            # Pick a random project
            project = random.choice(all_projects)
            
            print(f"\n[{generated_count + skipped_count + 1}] {project['name']}")
            
            # Check if already cached
            if check_cache(project['name'], project['description']):
                print("  Already cached, skipping ⊘")
                skipped_count += 1
                time.sleep(0.5)  # Brief pause
                continue
            
            # Generate guide
            guide = generate_project_guide(project)
            
            if guide:
                # Save to cache
                if save_to_cache(project, guide):
                    generated_count += 1
                
                # Show stats every 3 generations
                if generated_count % 3 == 0:
                    stats = get_cache_stats()
                    if stats:
                        print(f"\n  📊 Cache stats: {stats['total_guides']} total guides\n")
            
            # Small delay between requests (projects take longer)
            time.sleep(3)
    
    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("Stopped by user")
        print(f"Generated: {generated_count} new project guides")
        print(f"Skipped: {skipped_count} already cached")
        
        # Final stats
        stats = get_cache_stats()
        if stats:
            print(f"\nFinal cache: {stats['total_guides']} total guides")
        print("=" * 70)
        return 0
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
