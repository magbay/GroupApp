document.addEventListener('DOMContentLoaded', async () => {
    const nameForm = document.getElementById('name-form');
    const nameInput = document.getElementById('name-input');
    const nameList = document.getElementById('name-list');

    const taskList = document.getElementById('task-list');

    const randomButton = document.getElementById('random-button');
    const manualButton = document.getElementById('manual-button');
    const resultDisplay = document.getElementById('result');
    const groupSizeInput = document.getElementById('group-size');
    const uniqueTasksCheckbox = document.getElementById('unique-tasks');
    const advancedModeCheckbox = document.getElementById('advanced-mode');
    const clearResultsButton = document.getElementById('clear-results');
    const exportResultsButton = document.getElementById('export-results');

    const taskModal = document.getElementById('task-modal');
    const taskDescriptionInput = document.getElementById('task-description');
    const saveTaskDescriptionButton = document.getElementById('save-task-description');
    const taskModalCloseButton = taskModal.querySelector('.close-btn');

    const resultModal = document.getElementById('result-modal');
    const resultTaskDescription = document.getElementById('result-task-description');
    const resultModalCloseButton = resultModal.querySelector('.close-btn');

    const manualAssignmentModal = document.getElementById('manual-assignment-modal');
    const manualAssignmentContainer = document.getElementById('manual-assignment-container');
    const saveManualAssignmentButton = document.getElementById('save-manual-assignment');
    const cancelManualAssignmentButton = document.getElementById('cancel-manual-assignment');
    const manualModalCloseButton = manualAssignmentModal.querySelector('.close-btn');

    let names = JSON.parse(localStorage.getItem('names')) || [];
    let tasks = [];
    let currentTaskIndex = -1;
    let manualAssignments = [];
    let ollamaEndpoints = [];
    let currentOllamaUrl = '';
    let currentOllamaModel = 'qwen3:8b';

    // Parse endpoint config: URL|MODEL or just URL
    function parseEndpointConfig(config) {
        const parts = config.split('|');
        return {
            url: parts[0].trim(),
            model: parts[1] ? parts[1].trim() : 'qwen3:8b'
        };
    }

    // Load Ollama endpoints from models.txt
    async function loadOllamaEndpoints() {
        try {
            const response = await fetch('models.txt');
            if (response.ok) {
                const text = await response.text();
                const lines = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                ollamaEndpoints = lines;
                
                // Load saved endpoint or use first one
                const saved = localStorage.getItem('selectedOllamaEndpoint');
                if (saved && ollamaEndpoints.includes(saved)) {
                    const config = parseEndpointConfig(saved);
                    currentOllamaUrl = config.url;
                    currentOllamaModel = config.model;
                } else if (ollamaEndpoints.length > 0) {
                    const config = parseEndpointConfig(ollamaEndpoints[0]);
                    currentOllamaUrl = config.url;
                    currentOllamaModel = config.model;
                }
                
                updateOllamaSelector();
            }
        } catch (error) {
            console.error('Error loading models.txt:', error);
            currentOllamaUrl = 'http://10.107.101.37:8001'; // fallback
            currentOllamaModel = 'qwen3:8b';
        }
    }

    function updateOllamaSelector() {
        const selector = document.getElementById('ollama-endpoint-select');
        if (selector && ollamaEndpoints.length > 0) {
            selector.innerHTML = ollamaEndpoints.map(endpoint => {
                const config = parseEndpointConfig(endpoint);
                const label = config.url.includes('ngrok') ? 'Ngrok Tunnel' : 'Local Ollama';
                return `<option value="${endpoint}">${label} - ${config.model}</option>`;
            }).join('');
            // Find and select the current config
            const currentConfig = ollamaEndpoints.find(ep => {
                const cfg = parseEndpointConfig(ep);
                return cfg.url === currentOllamaUrl;
            });
            if (currentConfig) {
                selector.value = currentConfig;
            }
        }
    }

    const converter = new showdown.Converter({
        tables: true,
        strikethrough: true,
        tasklists: true,
        ghCodeBlocks: true,
        simpleLineBreaks: true,
        openLinksInNewWindow: true,
        backslashEscapesHTMLTags: false,
        literalMidWordUnderscores: true,
        parseImgDimensions: true
    });

    // Re-enable markdown conversion for better formatting
    function formatWithCodeBlocks(text) {
        return converter.makeHtml(text);
    }

    const renderNames = () => {
        nameList.innerHTML = '';
        names.forEach((name, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${name}</span>
                <button class="delete-btn" data-index="${index}">Delete</button>
            `;
            nameList.appendChild(li);
        });
    };

    const renderTasks = () => {
        taskList.innerHTML = '';
        tasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span data-index="${index}">${task.name}</span>
                <button class="delete-btn" data-index="${index}">Delete</button>
            `;
            taskList.appendChild(li);
        });
    };

    const saveNames = () => {
        localStorage.setItem('names', JSON.stringify(names));
    };

    // Load names from names.txt and merge with localStorage names (file names first)
    const loadNamesFromFile = async () => {
        try {
            const resp = await fetch('names.txt');
            if (!resp.ok) return;
            const text = await resp.text();
            const fileNames = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            // Merge: file names first, then any localStorage names not already present
            const merged = [...fileNames];
            names.forEach(n => { if (!merged.includes(n)) merged.push(n); });
            names = merged;
            saveNames();
            renderNames();
        } catch (e) {
            console.warn('Could not load names.txt:', e);
        }
    };

    // Load tasks from a given file (format: Name : description)
    let currentTaskFile = 'linux.txt';
    const taskTabs = document.querySelectorAll('.tab-btn');
    const setActiveTab = (file) => {
        taskTabs.forEach(b => b.classList.toggle('active', b.dataset.file === file));
        currentTaskFile = file;
    };

    const loadTasksFromFile = async (file = currentTaskFile) => {
        try {
            const response = await fetch(file);
            if (!response.ok) {
                tasks = [];
                renderTasks();
                return;
            }
            const text = await response.text();
            tasks = text.split('\n').map(line => {
                const [name, ...description] = line.split(':');
                return { name: (name||'').trim(), description: (description||[]).join(':').trim() };
            }).filter(task => task.name);
            renderTasks();
        } catch (error) {
            console.error('Error loading tasks file', file, error);
            tasks = [];
            renderTasks();
        }
    };

    // Wire tab buttons and regenerate buttons
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('tab-btn')) {
            const file = e.target.dataset.file;
            setActiveTab(file);
            loadTasksFromFile(file);
        }
        
        // Handle regenerate button clicks
        if (e.target && e.target.classList && e.target.classList.contains('regenerate-btn')) {
            const assignmentId = parseInt(e.target.dataset.assignmentId, 10);
            const assignment = lastAssignments.find(a => a.id === assignmentId);
            if (assignment) {
                // Delete from cache and regenerate
                const isAdvanced = advancedModeCheckbox?.checked || false;
                fetch('http://10.107.101.37:8001/api/cache/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_name: assignment.taskName,
                        task_description: assignment.taskDescription,
                        is_advanced: isAdvanced,
                        model_name: currentOllamaModel
                    })
                }).then(() => {
                    // Reset the guide display
                    const target = document.getElementById(`guide-${assignmentId}`);
                    const loading = target?.previousElementSibling;
                    if (loading) {
                        loading.textContent = 'Regenerating guide with Ollama…';
                        loading.style.color = '';
                    }
                    if (target) {
                        target.innerHTML = '';
                    }
                    // Regenerate
                    fetchOllamaGuideForAssignment(assignment, true);
                }).catch(err => console.error('Failed to delete cache:', err));
            }
        }
    });

    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = nameInput.value.trim();
        if (newName) {
            names.push(newName);
            nameInput.value = '';
            saveNames();
            renderNames();
        }
    });

    nameList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            names.splice(index, 1);
            saveNames();
            renderNames();
        }
    });

    taskList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const index = parseInt(e.target.dataset.index, 10);
            tasks.splice(index, 1);
            renderTasks();
        }
    });

    taskModalCloseButton.addEventListener('click', () => {
        taskModal.style.display = 'none';
    });

    saveTaskDescriptionButton.addEventListener('click', () => {
        if (currentTaskIndex > -1) {
            tasks[currentTaskIndex].description = taskDescriptionInput.value;
            taskModal.style.display = 'none';
        }
    });

    resultModalCloseButton.addEventListener('click', () => {
        resultModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == taskModal) {
            taskModal.style.display = 'none';
        }
        if (e.target == resultModal) {
            resultModal.style.display = 'none';
        }
    });

    let lastAssignments = [];

    randomButton.addEventListener('click', () => {
        const groupSize = Math.max(1, Math.min(10, parseInt(groupSizeInput?.value || '2', 10) || 2));
        const uniqueTasksOnly = !!uniqueTasksCheckbox?.checked;

        if (names.length < 1) {
            resultDisplay.textContent = 'Please add at least one name.';
            return;
        }

        if (tasks.length < 1) {
            resultDisplay.textContent = 'Please add at least one task.';
            return;
        }

        const shuffledNames = [...names].sort(() => 0.5 - Math.random());
        const groups = [];

        while (shuffledNames.length > 0) {
            const group = shuffledNames.splice(0, groupSize);
            groups.push(group);
        }

        if (uniqueTasksOnly && tasks.length < groups.length) {
            resultDisplay.textContent = `Not enough tasks (${tasks.length}) for ${groups.length} unique assignments. Add more tasks or uncheck Unique tasks.`;
            return;
        }

        // Prepare task selection strategy
        let taskPicker;
        if (uniqueTasksOnly) {
            const shuffledTasks = [...tasks].sort(() => 0.5 - Math.random());
            let idx = 0;
            taskPicker = () => shuffledTasks[idx++];
        } else {
            taskPicker = () => tasks[Math.floor(Math.random() * tasks.length)];
        }

        lastAssignments = [];
        // Build assignment cards with placeholders for AI guides.
        const cards = [];
        groups.forEach((group, idx) => {
            const selectedTask = taskPicker();
            const descriptionHtml = converter.makeHtml(selectedTask.description || '');
            
            // Assign Driver/Navigator roles randomly
            const roles = ['Driver', 'Navigator'];
            const membersWithRoles = group.map((name, i) => {
                if (group.length === 1) return name; // Solo gets no role label
                const role = roles[i % 2]; // alternate, or pick randomly
                return `${name} (${role})`;
            });
            
            lastAssignments.push({
                id: idx,
                group: [...group],
                membersWithRoles: [...membersWithRoles],
                taskName: selectedTask.name,
                taskDescription: selectedTask.description || ''
            });
            cards.push(`
                <div class=\"assignment-card\" data-assign-id=\"${idx}\"> 
                  <p class=\"assignment-line\" data-description=\"${escape(descriptionHtml)}\">${membersWithRoles.join(', ')} — <strong>${selectedTask.name}</strong></p>
                  <div class=\"guide-container\"> 
                    <div class=\"guide-loading\">Generating guide with Ollama…</div>
                    <div class=\"guide-content\" id=\"guide-${idx}\"></div>
                  </div>
                </div>
            `);
        });
        resultDisplay.innerHTML = cards.join('');

        // After rendering, fetch guides for each assignment with limited concurrency
        const tasksFetchers = lastAssignments.map((a) => () => fetchOllamaGuideForAssignment(a));
        runWithConcurrency(tasksFetchers, 2).catch(err => console.error('Guide generation error:', err));
    });

    clearResultsButton?.addEventListener('click', () => {
        resultDisplay.innerHTML = '';
        lastAssignments = [];
    });

    exportResultsButton?.addEventListener('click', async () => {
        if (!lastAssignments.length) {
            alert('No assignments to copy.');
            return;
        }
        
        // Build plain-text copy of the entire result output
        let copyText = '=== Task Assignments ===\n\n';
        for (const a of lastAssignments) {
            const members = a.membersWithRoles ? a.membersWithRoles.join(', ') : a.group.join(', ');
            copyText += `${members} — ${a.taskName}\n`;
            
            // Grab the generated guide if available
            const guideEl = document.getElementById(`guide-${a.id}`);
            if (guideEl && guideEl.textContent.trim()) {
                copyText += `Guide:\n${guideEl.textContent.trim()}\n`;
            }
            copyText += '\n';
        }
        
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(copyText);
            alert('Results copied to clipboard!');
        } catch (e) {
            console.error('Copy failed:', e);
            alert('Failed to copy. Please try again or copy manually.');
        }
    });

    // ----- Ollama Guide Generation per Assignment -----

    function buildGuidePrompt(taskName, taskDescription, groupMembers) {
        const desc = taskDescription && taskDescription.trim().length > 0 ? taskDescription.trim() : '(no detailed description provided)';
        const members = groupMembers.join(', ');
        const isAdvanced = advancedModeCheckbox?.checked || false;
        
        if (isAdvanced) {
            return `You are an expert-level technical documentation specialist and security professional. Create a comprehensive, ADVANCED KB (Knowledge Base) article to help complete the task below. This guide should be TWICE the length of a standard guide and include expert-level knowledge, security considerations, advanced techniques, and deep technical details.

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

Task: ${taskName}
Assigned to: ${members}
Task details: ${desc}

Make this guide comprehensive and detailed (20-30+ steps). Include detailed command examples with explanations, configuration files, security best practices, and advanced techniques throughout.`;
        } else {
            return `You are a technical documentation expert. Create a step-by-step KB (Knowledge Base) article to help complete the task below.

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

Task: ${taskName}
Assigned to: ${members}
Task details: ${desc}

Keep it concise (10-15 steps maximum). Include command examples in code blocks where relevant.`;
        }
    }

    async function fetchOllamaGuideForAssignment(assignment, forceRegenerate = false) {
        const targetId = `guide-${assignment.id}`;
        const target = document.getElementById(targetId);
        const loading = target?.previousElementSibling; // .guide-loading
        if (!target) return;

        const isAdvanced = advancedModeCheckbox?.checked || false;

        // Check cache first (unless force regenerate)
        if (!forceRegenerate) {
            try {
                const cacheResponse = await fetch('http://10.107.101.37:8001/api/cache/get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_name: assignment.taskName,
                        task_description: assignment.taskDescription,
                        is_advanced: isAdvanced,
                        model_name: currentOllamaModel
                    })
                });

                if (cacheResponse.ok) {
                    const cacheData = await cacheResponse.json();
                    if (cacheData.found) {
                        // Display cached content
                        const html = formatWithCodeBlocks(cacheData.guide_content);
                        if (loading && loading.classList.contains('guide-loading')) {
                            loading.textContent = `✓ Cached (${new Date(cacheData.created_at).toLocaleString()})`;
                            loading.style.color = '#10b981';
                        }
                        target.innerHTML = html + `
                            <div style="margin-top: 1rem; padding: 0.5rem; background: #f1f5f9; border-radius: 4px; font-size: 0.8rem;">
                                <button class="regenerate-btn" data-assignment-id="${assignment.id}" style="padding: 0.4rem 0.8rem; background: linear-gradient(90deg, #f59e0b, #d97706); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                    🔄 Regenerate Guide
                                </button>
                                <span style="margin-left: 0.5rem; color: #64748b;">Cached from ${new Date(cacheData.created_at).toLocaleString()}</span>
                            </div>
                        `;
                        return;
                    }
                }
            } catch (e) {
                console.log('Cache check failed, generating new:', e);
            }
        }

        const prompt = buildGuidePrompt(assignment.taskName, assignment.taskDescription, assignment.group);

        // Accumulate streamed text, then render as Markdown when done
        let textBuffer = '';
        try {
            // Always use local proxy, send target URL in header
            const fetchUrl = 'http://10.107.101.37:8001/api/generate';
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            
            // If using external URL (ngrok), send it in header for proxy to forward
            if (currentOllamaUrl.startsWith('https://')) {
                headers['X-Ollama-Target'] = currentOllamaUrl;
            }
            
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: currentOllamaModel,
                    prompt: prompt
                })
            });

            if (!response.ok || !response.body) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed.response) {
                            textBuffer += parsed.response;
                        }
                    } catch (_) { /* ignore partial */ }
                }
            }

            // Remove thinking tags and their content before rendering
            const cleanedText = textBuffer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            
            // Save to cache
            try {
                await fetch('http://10.107.101.37:8001/api/cache/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        task_name: assignment.taskName,
                        task_description: assignment.taskDescription,
                        is_advanced: isAdvanced,
                        model_name: currentOllamaModel,
                        guide_content: cleanedText
                    })
                });
            } catch (e) {
                console.log('Failed to cache guide:', e);
            }
            
            // Render with enhanced code block formatting
            const html = formatWithCodeBlocks(cleanedText);
            if (loading && loading.classList.contains('guide-loading')) loading.remove();
            target.innerHTML = html + `
                <div style="margin-top: 1rem; padding: 0.5rem; background: #f1f5f9; border-radius: 4px; font-size: 0.8rem;">
                    <button class="regenerate-btn" data-assignment-id="${assignment.id}" style="padding: 0.4rem 0.8rem; background: linear-gradient(90deg, #f59e0b, #d97706); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                        🔄 Regenerate Guide
                    </button>
                    <span style="margin-left: 0.5rem; color: #64748b;">Generated just now</span>
                </div>
            ` || '<em>No guidance generated.</em>';
        } catch (e) {
            console.error('Ollama guide error:', e);
            if (loading && loading.classList.contains('guide-loading')) loading.textContent = 'Failed to generate guide.';
            target.innerHTML = '';
        }
    }

    // Simple concurrency runner for an array of thunk functions returning promises
    async function runWithConcurrency(thunks, limit = 2) {
        const queue = [...thunks];
        const workers = new Array(Math.min(limit, queue.length)).fill(null).map(async () => {
            while (queue.length) {
                const job = queue.shift();
                try {
                    await job();
                } catch (e) {
                    console.error('Guide job failed:', e);
                }
            }
        });
        await Promise.all(workers);
    }

    resultDisplay.addEventListener('click', (e) => {
        if (e.target.tagName === 'P' && e.target.dataset.description) {
            resultTaskDescription.innerHTML = unescape(e.target.dataset.description);
            resultModal.style.display = 'block';
        }
    });

    // Prefer file-backed names but merge with localStorage
    await loadNamesFromFile();
    // Load default tasks after names are ready (currentTaskFile set by tabs default)
    setActiveTab(currentTaskFile);
    await loadTasksFromFile(currentTaskFile);
    // Load Ollama endpoints configuration
    await loadOllamaEndpoints();

    // Ollama endpoint selector event listener
    const ollamaEndpointSelect = document.getElementById('ollama-endpoint-select');
    if (ollamaEndpointSelect) {
        ollamaEndpointSelect.addEventListener('change', (e) => {
            const config = parseEndpointConfig(e.target.value);
            currentOllamaUrl = config.url;
            currentOllamaModel = config.model;
            localStorage.setItem('selectedOllamaEndpoint', e.target.value);
            console.log('Switched to Ollama endpoint:', currentOllamaUrl, 'Model:', currentOllamaModel);
        });
    }

    const ollamaInput = document.getElementById('ollama-input');
    const ollamaButton = document.getElementById('ollama-button');
    const ollamaResponse = document.getElementById('ollama-response');
    const ollamaLoading = document.getElementById('ollama-loading');

    // Listen for server-sent events to trigger page refreshes when other users connect
    try {
        const evtSource = new EventSource('/events');
        evtSource.onmessage = (e) => {
            if (e.data && e.data.trim() === 'reload') {
                console.log('Received reload event, refreshing page');
                window.location.reload(true);
            }
        };
        evtSource.onerror = (err) => {
            console.warn('EventSource error', err);
        };
    } catch (e) {
        console.warn('SSE not supported:', e);
    }

    ollamaButton.addEventListener('click', async () => {
        const prompt = ollamaInput.value;
        if (!prompt) return;

        ollamaResponse.innerHTML = '';
        ollamaInput.value = '';
        
        // Show loading indicator
        ollamaLoading.style.display = 'flex';

        try {
            // Always use local proxy, send target URL in header
            const fetchUrl = 'http://10.107.101.37:8001/api/generate';
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            
            // If using external URL (ngrok), send it in header for proxy to forward
            if (currentOllamaUrl.startsWith('https://')) {
                headers['X-Ollama-Target'] = currentOllamaUrl;
            }
            
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: currentOllamaModel,
                    prompt: prompt
                })
            });

            if (!response.ok || !response.body) {
                const msg = `Request failed with status ${response.status}`;
                console.error(msg);
                ollamaResponse.innerHTML = msg;
                ollamaLoading.style.display = 'none';
                return;
            }

            // Hide loading indicator once streaming starts
            ollamaLoading.style.display = 'none';

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';
            let displayText = '';
            let insideThink = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed.response) {
                            fullText += parsed.response;
                            
                            // Process character by character to track <think> tags
                            for (let char of parsed.response) {
                                if (fullText.slice(-7) === '<think>') {
                                    insideThink = true;
                                    // Remove the '<think>' we just added to display
                                    displayText = displayText.slice(0, -7);
                                }
                                
                                if (!insideThink) {
                                    displayText += char;
                                }
                                
                                if (fullText.slice(-8) === '</think>') {
                                    insideThink = false;
                                    displayText = displayText.slice(0, -8);
                                }
                            }
                            
                            // Update display with cleaned text using enhanced formatter
                            ollamaResponse.innerHTML = formatWithCodeBlocks(displayText);
                        }
                    } catch (e) {
                        // Ignore partial/invalid JSON lines; they will complete on next chunk
                    }
                }
            }

            // Flush any remaining buffered line
            const last = buffer.trim();
            if (last) {
                try {
                    const parsed = JSON.parse(last);
                    if (parsed.response) {
                        fullText += parsed.response;
                        
                        for (let char of parsed.response) {
                            if (fullText.slice(-7) === '<think>') {
                                insideThink = true;
                                displayText = displayText.slice(0, -7);
                            }
                            
                            if (!insideThink) {
                                displayText += char;
                            }
                            
                            if (fullText.slice(-8) === '</think>') {
                                insideThink = false;
                                displayText = displayText.slice(0, -8);
                            }
                        }
                        
                        // Final render using enhanced formatter
                        ollamaResponse.innerHTML = formatWithCodeBlocks(displayText);
                        // Hide loading indicator
                        ollamaLoading.style.display = 'none';
                    }
                } catch (_) {
                    // ignore
                }
            }
        } catch (error) {
            console.error('Error with Ollama:', error);
            ollamaResponse.innerHTML = 'Error communicating with Ollama.';
            ollamaLoading.style.display = 'none';
        }
    });

    // Manual Task Assignment
    manualButton?.addEventListener('click', async () => {
        if (names.length === 0) {
            alert('Please add at least one name first.');
            return;
        }

        const groupSize = parseInt(groupSizeInput.value, 10) || 2;

        // Create groups
        const shuffledNames = [...names].sort(() => 0.5 - Math.random());
        const groups = [];
        while (shuffledNames.length > 0) {
            const group = shuffledNames.splice(0, groupSize);
            groups.push(group);
        }

        // Load all task categories
        const taskFiles = ['ccna.txt', 'linux.txt', 'sysadmin.txt', 'hacking.txt', 'python.txt', 'javascript.txt', 'ai.txt'];
        const allTasksByCategory = {};

        for (const file of taskFiles) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const text = await response.text();
                    const categoryTasks = text.split('\n').map(line => {
                        const [name, ...description] = line.split(':');
                        return { name: (name||'').trim(), description: (description||[]).join(':').trim() };
                    }).filter(task => task.name);
                    
                    const categoryName = file.replace('.txt', '').toUpperCase();
                    allTasksByCategory[categoryName] = categoryTasks;
                }
            } catch (error) {
                console.error('Error loading', file, error);
            }
        }

        // Initialize manual assignments
        manualAssignments = groups.map((group, idx) => ({
            id: idx,
            group: [...group],
            selectedTasks: []
        }));

        // Build the modal content
        let html = '';
        groups.forEach((group, idx) => {
            html += `
                <div class="team-assignment-block">
                    <h3>Team ${idx + 1}</h3>
                    <div class="team-members">Members: ${group.join(', ')}</div>
                    <div id="selected-task-desc-${idx}" class="selected-task-description" style="display: none;"></div>
            `;

            // Add task selection for each category
            for (const [category, categoryTasks] of Object.entries(allTasksByCategory)) {
                html += `
                    <div class="task-category-section">
                        <h4>${category}</h4>
                        <div class="task-selection-list">
                `;

                categoryTasks.forEach((task, taskIdx) => {
                    const radioId = `task-${idx}-${category}-${taskIdx}`;
                    html += `
                        <div class="task-selection-item">
                            <input type="radio" 
                                   name="team-${idx}-task"
                                   id="${radioId}" 
                                   data-team-id="${idx}" 
                                   data-category="${category}"
                                   data-task-name="${task.name}"
                                   data-task-description="${escape(task.description)}">
                            <label for="${radioId}">${task.name}</label>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
        });

        manualAssignmentContainer.innerHTML = html;

        // Add event listeners for radio button changes to show description
        const radioButtons = manualAssignmentContainer.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    const teamId = e.target.dataset.teamId;
                    const taskDescription = unescape(e.target.dataset.taskDescription);
                    const descEl = document.getElementById(`selected-task-desc-${teamId}`);
                    if (descEl) {
                        descEl.innerHTML = `<strong>Task Description:</strong> ${converter.makeHtml(taskDescription)}`;
                        descEl.style.display = 'block';
                    }
                }
            });
        });

        manualAssignmentModal.style.display = 'block';
    });

    saveManualAssignmentButton?.addEventListener('click', () => {
        // Collect selected tasks for each team
        const radioButtons = manualAssignmentContainer.querySelectorAll('input[type="radio"]:checked');
        
        // Reset selections
        manualAssignments.forEach(a => a.selectedTasks = []);

        radioButtons.forEach(radio => {
            const teamId = parseInt(radio.dataset.teamId, 10);
            const taskName = radio.dataset.taskName;
            const taskDescription = unescape(radio.dataset.taskDescription);
            
            manualAssignments[teamId].selectedTasks.push({
                name: taskName,
                description: taskDescription
            });
        });

        // Build result display
        lastAssignments = [];
        const cards = [];

        manualAssignments.forEach((assignment, idx) => {
            if (assignment.selectedTasks.length === 0) {
                cards.push(`
                    <div class="assignment-card">
                        <p class="assignment-line">${assignment.group.join(', ')} — <strong>No tasks selected</strong></p>
                    </div>
                `);
                return;
            }

            assignment.selectedTasks.forEach(task => {
                const descriptionHtml = converter.makeHtml(task.description || '');
                
                const roles = ['Driver', 'Navigator'];
                const membersWithRoles = assignment.group.map((name, i) => {
                    if (assignment.group.length === 1) return name;
                    const role = roles[i % 2];
                    return `${name} (${role})`;
                });

                const assignmentId = lastAssignments.length;
                lastAssignments.push({
                    id: assignmentId,
                    group: [...assignment.group],
                    membersWithRoles: [...membersWithRoles],
                    taskName: task.name,
                    taskDescription: task.description || ''
                });

                cards.push(`
                    <div class="assignment-card" data-assign-id="${assignmentId}">
                        <p class="assignment-line" data-description="${escape(descriptionHtml)}">${membersWithRoles.join(', ')} — <strong>${task.name}</strong></p>
                        <div class="guide-container">
                            <div class="guide-loading">Generating guide with Ollama…</div>
                            <div class="guide-content" id="guide-${assignmentId}"></div>
                        </div>
                    </div>
                `);
            });
        });

        resultDisplay.innerHTML = cards.join('');
        
        // Generate guides
        const tasksFetchers = lastAssignments.map((a) => () => fetchOllamaGuideForAssignment(a));
        runWithConcurrency(tasksFetchers, 2).catch(err => console.error('Guide generation error:', err));

        manualAssignmentModal.style.display = 'none';
    });

    cancelManualAssignmentButton?.addEventListener('click', () => {
        manualAssignmentModal.style.display = 'none';
    });

    manualModalCloseButton?.addEventListener('click', () => {
        manualAssignmentModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === manualAssignmentModal) {
            manualAssignmentModal.style.display = 'none';
        }
    });
});

function escape(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function unescape(text) {
    return text.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}