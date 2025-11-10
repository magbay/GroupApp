document.addEventListener('DOMContentLoaded', async () => {
    const nameForm = document.getElementById('name-form');
    const nameInput = document.getElementById('name-input');
    const nameList = document.getElementById('name-list');

    const taskList = document.getElementById('task-list');

    const randomButton = document.getElementById('random-button');
    const resultDisplay = document.getElementById('result');
    const groupSizeInput = document.getElementById('group-size');
    const uniqueTasksCheckbox = document.getElementById('unique-tasks');
    const clearResultsButton = document.getElementById('clear-results');
    const exportResultsButton = document.getElementById('export-results');

    const taskModal = document.getElementById('task-modal');
    const taskDescriptionInput = document.getElementById('task-description');
    const saveTaskDescriptionButton = document.getElementById('save-task-description');
    const taskModalCloseButton = taskModal.querySelector('.close-btn');

    const resultModal = document.getElementById('result-modal');
    const resultTaskDescription = document.getElementById('result-task-description');
    const resultModalCloseButton = resultModal.querySelector('.close-btn');

    let names = JSON.parse(localStorage.getItem('names')) || [];
    let tasks = [];
    let currentTaskIndex = -1;

    const converter = new showdown.Converter();

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

    // Wire tab buttons
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('tab-btn')) {
            const file = e.target.dataset.file;
            setActiveTab(file);
            loadTasksFromFile(file);
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
        return `You are an expert technical assistant. Create a concise, actionable guide in Markdown (10 to 15 sentences) to help complete the task below. Create a guide for beginners. Give tips on how to research and find tutorial resources. Create and prioritize muscle memory exercises. Avoid filler. If relevant, include one short code block or command snippet. Do not exceed 15 sentences.

Task: ${taskName}
Assigned to: ${members}
Task details: ${desc}`;
    }

    async function fetchOllamaGuideForAssignment(assignment) {
        const targetId = `guide-${assignment.id}`;
        const target = document.getElementById(targetId);
        const loading = target?.previousElementSibling; // .guide-loading
        if (!target) return;

        const prompt = buildGuidePrompt(assignment.taskName, assignment.taskDescription, assignment.group);

        // Accumulate streamed text, then render as Markdown when done
        let textBuffer = '';
        try {
            const OLLAMA_BASE_URL = 'http://10.107.101.37:8001';
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen3:8b',
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
            
            // Render Markdown
            const html = converter.makeHtml(cleanedText);
            if (loading && loading.classList.contains('guide-loading')) loading.remove();
            target.innerHTML = html || '<em>No guidance generated.</em>';
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

    const ollamaInput = document.getElementById('ollama-input');
    const ollamaButton = document.getElementById('ollama-button');
    const ollamaResponse = document.getElementById('ollama-response');

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

    // NOTE: Update this base URL to point at your Ollama proxy
    const OLLAMA_BASE_URL = 'http://10.107.101.37:8001';

        try {
            const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen3:8b',
                    prompt: prompt
                })
            });

            if (!response.ok || !response.body) {
                const msg = `Request failed with status ${response.status}`;
                console.error(msg);
                ollamaResponse.innerHTML = msg;
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let insideThink = false;
            let fullText = '';

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
                    }
                } catch (_) {
                    // ignore
                }
            }

            // Remove thinking tags and their content
            const cleanedText = fullText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
            
            // Basic HTML escape to avoid unintended markup
            const safe = cleanedText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            ollamaResponse.innerHTML = safe;
        } catch (error) {
            console.error('Error with Ollama:', error);
            ollamaResponse.innerHTML = 'Error communicating with Ollama.';
        }
    });
});