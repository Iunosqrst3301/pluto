// Test comment
// --- Utility Functions ---
function getFutureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

function formatDueDate(dateString) {
    if (!dateString) return "No date";
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Normalize dates to ignore time
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateString === todayStr) return 'Today';
    if (dateString === tomorrowStr) return 'Tomorrow';
    
    // Fallback for other dates
    const date = new Date(dateString + 'T00:00:00'); // Ensure correct timezone
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// --- Gemini API Integration ---
const GEMINI_API_KEY = 'AIzaSyAUQmgz1VEAisRCn40qbVvtLevJlDTyDBg'; // Replace with your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGeminiAPI(prompt) {
    try {
        console.log('Calling Gemini API with prompt:', prompt.substring(0, 100) + '...');
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            return data.candidates[0].content.parts[0].text;
        } else {
            console.error('Unexpected API response format:', data);
            return null;
        }
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return null;
    }
}

async function generateTasksFromUserInput(userInput) {
    const todayForAI = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const prompt = `
You are an efficient assistant, that helps the user plan their day.
Based on the user's request, if needed, create a JSON array of 3-5 short, actionable tasks.

For each task, provide:
- "name": A short, clear task name (max 5 words).
- "description": A simple, one-sentence description.
- "priority": "Low", "Medium", "High".
- "dueDate": A date in "YYYY-MM-DD" format. Only assign if the user specifies a date. If not, use an empty string "".
  - IMPORTANT: Today's date is ${todayForAI}. Use this date for any tasks the user wants to do "today".
- "recurrence": How the task repeats. Use ONE of the following values: "none", "daily", "weekly", "mondays", "tuesdays", "wednesdays", "thursdays", "fridays", "saturdays", "sundays".
  - If no recurrence is mentioned, use "none".
  - For tasks like "every day", use "daily".
  - For tasks that repeat on a specific day of the week (e.g., "every Friday"), use that day's value (e.g., "fridays").
  - For tasks that repeat weekly from a specific start date, use "weekly" and set the "dueDate".

User input: "${userInput}"

Example of a response for a user input of "I need to do a daily check-in and also submit my report every friday":
[
  {
    "name": "Daily team check-in",
    "description": "Quick sync with the team on daily progress.",
    "priority": "Medium",
    "dueDate": "",
    "recurrence": "daily"
  },
  {
    "name": "Submit weekly report",
    "description": "Compile and send the weekly progress report.",
    "priority": "High",
    "dueDate": "",
    "recurrence": "fridays"
  }
]

IMPORTANT: Respond with ONLY the JSON array and nothing else. Do not include any introductory text, backticks, or explanations.
`;

    const response = await callGeminiAPI(prompt);
    if (!response) {
        console.log('API failed, using fallback tasks');
        // Return some basic fallback tasks based on common keywords
        const fallbackTasks = [
            {
                name: "Break down goals",
                description: "Take your main objective and break it into smaller, manageable steps",
                priority: "High",
                dueDate: getFutureDate(0)
            },
            {
                name: "Set priorities",
                description: "Identify which tasks are most important and urgent",
                priority: "High", 
                dueDate: getFutureDate(0)
            },
            {
                name: "Create timeline",
                description: "Map out when each task should be completed",
                priority: "Medium",
                dueDate: getFutureDate(1)
            }
        ];
        return fallbackTasks;
    }

    try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (error) {
        console.error('Error parsing Gemini response:', error);
        console.log('Response was:', response);
        // Return fallback tasks if parsing fails
        return [
            {
                name: "Review input",
                description: "Take a moment to reflect on what you want to accomplish",
                priority: "Medium",
                dueDate: getFutureDate(0)
            }
        ];
    }
}

async function generateAIResponse(userInput) {
    const prompt = `
You are Pluto, a calm and thoughtful guide. Your goal is to help the user reflect and organize their thoughts in a gentle, encouraging way. You are not a robot; you are a warm, friendly presence.

**Your Personality:**
- **Calm & Reassuring:** Use a relaxed and gentle tone.
- **Curious & Inquisitive:** Ask open-ended questions to help the user explore their own ideas.
- **Human-like & Natural:** Avoid clichés and repetitive phrases. Vary your sentence structure. Use contractions (e.g., "that's," "it's").
- **Concise:** Keep your responses to 1-3 short, natural sentences.

**Example Responses:**
- User: "I have so much to do today." -> AI: "It can definitely feel like that sometimes. Where does your mind want to start?"
- User: "I need to work on my project." -> AI: "Sounds like a good focus. What's one small piece of that project we could look at first?"
- User: "I don't know what to do." -> AI: "That's perfectly okay. Let's just breathe for a second. What's one thing, big or small, that's on your mind?"
- User: "finish my essay" -> AI: "An essay, cool. What's it about? We can break it down if you like."

**The user just said:** "${userInput}"

Now, as Pluto, give a short, natural, and thoughtful response.
`;

    const response = await callGeminiAPI(prompt);
    
    if (response) {
        return response;
    } else {
        const fallbackResponses = [
            "Got it. What's the first thing on your mind?",
            "Okay, let's break that down. What's step one?",
            "Sounds like a plan. Where should we start?",
            "I'm with you. What's the main goal here?"
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

// --- Data ---
let tasks = {};
let taskNames = [];

/**
 * Checks if a task is scheduled to occur on a specific date,
 * accounting for one-time due dates and recurrence rules.
 * @param {object} task The task object.
 * @param {Date} date The date to check against.
 * @returns {boolean} True if the task should be displayed on the given date.
 */
function isTaskDueOn(task, date) {
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // 1. If this specific instance has been completed, it's not due.
    if (task.completions && task.completions.includes(dateString)) {
        return false;
    }

    let hasExactDateMatch = false;
    let hasRecurrenceMatch = false;

    // Condition 1: Check for an exact date match.
    if (task.dueDate === dateString) {
        hasExactDateMatch = true;
    }

    // Condition 2: Check for a recurrence rule match.
    if (task.recurrence && task.recurrence !== 'none') {
        const dayOfWeek = date.getDay();
        const recurrence = task.recurrence;

        switch (recurrence) {
            case 'daily':
                hasRecurrenceMatch = true;
                break;
            case 'weekly':
                if (task.dueDate) {
                    const startDate = new Date(task.dueDate + 'T00:00:00');
                    if (date.getDay() === startDate.getDay() && date >= startDate) {
                        hasRecurrenceMatch = true;
                    }
                }
                break;
            case 'sundays': if (dayOfWeek === 0) hasRecurrenceMatch = true; break;
            case 'mondays': if (dayOfWeek === 1) hasRecurrenceMatch = true; break;
            case 'tuesdays': if (dayOfWeek === 2) hasRecurrenceMatch = true; break;
            case 'wednesdays': if (dayOfWeek === 3) hasRecurrenceMatch = true; break;
            case 'thursdays': if (dayOfWeek === 4) hasRecurrenceMatch = true; break;
            case 'fridays': if (dayOfWeek === 5) hasRecurrenceMatch = true; break;
            case 'saturdays': if (dayOfWeek === 6) hasRecurrenceMatch = true; break;
        }
    }

    return hasExactDateMatch || hasRecurrenceMatch;
}

/**
 * Clears and redraws all task bubbles based on what is due on a given date.
 * @param {Date} targetDate The date for which to render bubbles.
 */
function renderBubblesForDate(targetDate) {
    // Remove all existing non-greeting bubbles
    bubbles.forEach(bubble => {
        if (!bubble.isGreeting && bubble.element) {
            bubble.element.remove();
        }
    });
    bubbles = bubbles.filter(b => b.isGreeting);

    // Add bubbles for tasks due on the target date
    Object.values(tasks).forEach(task => {
        if (isTaskDueOn(task, targetDate)) {
            const x = Math.random() * (window.innerWidth - 120) + 60;
            const y = Math.random() * (window.innerHeight - 60) + 30;
            bubbles.push(new Bubble(x, y, task.name, task.id));
        }
    });
}

// Physics constants
const GRAVITY_STRENGTH = 0.0002; // Weaker gravity for a gentler drift
const DAMPING = 0.98;
const MAX_SPEED = 1.5;
const BUBBLE_RADIUS = 60;
const RESTITUTION = 0.8; // Bounciness for collisions

// Drag constants
const DRAG_STRENGTH = 1; // No longer a "strength", but used for direct control
const DRAG_DAMPING = 0.9; // Still useful for the mouse move handler

// Get the container element
const container = document.getElementById('bubbleContainer');

// Global drag state
let draggedBubble = null;

// --- Utility Functions ---
function calculateBubbleSize(priority, dueDate) {
    let size = 1.0; // Default size (Medium)

    // Adjust size based on priority
    if (priority === 'High') {
        size += 0.2;
    } else if (priority === 'Low') {
        size -= 0.2;
    }

    // Adjust size based on due date
    if (dueDate === 'Today' || dueDate === 'Tonight') {
        size += 0.15;
    }

    // Return an object with scale and radius
    return {
        scale: size,
        radius: BUBBLE_RADIUS * size // Scale the physics radius too
    };
}

// Bubble class to handle physics
class Bubble {
    constructor(x, y, taskName, taskId = null, isGreeting = false) {
        this.element = document.createElement('div');
        this.element.className = 'bubble';
        this.element.textContent = taskName;
        this.isGreeting = isGreeting;
        
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.taskName = taskName;
        this.taskId = taskId;
        
        // Calculate and set dynamic size
        const sizeInfo = calculateBubbleSize(isGreeting ? 'Medium' : tasks[taskId]?.priority, isGreeting ? null : tasks[taskId]?.dueDate);
        this.radius = sizeInfo.radius;
        this.element.style.transform = `scale(${sizeInfo.scale})`;

        this.isBeingDragged = false;
        this.hasMoved = false; // New property to track if a drag occurred
        this.wasJustDragged = false; // Flag to prevent click after drag
        this.clickTimeout = null; // For single vs double click detection
        
        // Add event listeners
        this.element.addEventListener('mousedown', this.startDrag.bind(this));
        
        this.element.addEventListener('click', (e) => {
            // If the bubble was just dragged, don't process this click as a pop/edit.
            // The 'wasJustDragged' flag is set on 'mouseup' if the mouse has moved.
            if (this.wasJustDragged) {
                this.wasJustDragged = false; // Reset the flag for the next click
                return;
            }

            // If a timeout is already running, it means this is the second click (a double-click)
            if (this.clickTimeout) {
                clearTimeout(this.clickTimeout);
                this.clickTimeout = null;
                this.showDescription(e, true); // This is the double-click action
            } else {
                // If no timeout is running, this is the first click.
                // Set a timeout for the single-click action.
                this.clickTimeout = setTimeout(() => {
                    this.pop(); // This is the single-click action
                    this.clickTimeout = null; // Reset timeout ID
                }, 250); // Wait to see if a second click follows
            }
        });
        
        container.appendChild(this.element);
        this.updatePosition();
    }
    
    startDrag(e) {
        if(e.button !== 0) return; // Only drag with left mouse button

        draggedBubble = this;
        this.isBeingDragged = true;
        this.hasMoved = false; // Reset on new drag
        this.wasJustDragged = false;
        this.element.classList.add('dragging');

        const rect = this.element.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left - rect.width / 2;
        this.dragOffsetY = e.clientY - rect.top - rect.height / 2;
    }
    
    stopDrag() {
        this.wasJustDragged = this.hasMoved; // Only counts as a "drag" if the mouse actually moved
        this.isBeingDragged = false;
        this.element.classList.remove('dragging');
    }

    showDescription(e, startInEditMode = false) {
        // Prevent event from bubbling up and triggering other clicks
        if (e) e.stopPropagation();
        
        // Don't open if a drag was just completed
        if (this.wasJustDragged) {
            this.wasJustDragged = false; // Reset the flag
            return;
        }
        showTaskDescription(this.taskId, startInEditMode);
    }
    
    applyPhysics(deltaTime) {
        // When dragged, physics is handled by the mouse
        if (this.isBeingDragged) return;

        // --- Apply Gravity ---
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const gravityX = (centerX - this.x) * GRAVITY_STRENGTH;
        const gravityY = (centerY - this.y) * GRAVITY_STRENGTH;
        this.vx += gravityX;
        this.vy += gravityY;

        // --- Apply Damping ---
        this.vx *= DAMPING;
        this.vy *= DAMPING;
        
        // --- Limit Speed ---
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > MAX_SPEED) {
            this.vx = (this.vx / speed) * MAX_SPEED;
            this.vy = (this.vy / speed) * MAX_SPEED;
        }

        // --- Update Position ---
        this.x += this.vx;
        this.y += this.vy;
    }

    handleBoundaryCollision() {
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx *= -RESTITUTION;
        } else if (this.x > window.innerWidth - this.radius) {
            this.x = window.innerWidth - this.radius;
            this.vx *= -RESTITUTION;
        }
        
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy *= -RESTITUTION;
        } else if (this.y > window.innerHeight - this.radius) {
            this.y = window.innerHeight - this.radius;
            this.vy *= -RESTITUTION;
        }
    }
    
    updatePosition() {
        this.element.style.left = (this.x - this.element.offsetWidth / 2) + 'px';
        this.element.style.top = (this.y - this.element.offsetHeight / 2) + 'px';
    }
    
    pop() {
        if (this.element.classList.contains('popping')) return; // Don't pop twice

        const task = tasks[this.taskId];

        if (task) {
            // If it's a recurring task, mark it as complete for today.
            // Otherwise, it's a one-time task, so delete it completely.
            if (task.recurrence && task.recurrence !== 'none') {
                const today = new Date();
                const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                
                // Initialize completions array if it doesn't exist
                if (!task.completions) {
                    task.completions = [];
                }
                task.completions.push(todayString);
            } else {
                delete tasks[this.taskId];
            }
        }

        // 2. Start the visual pop animation
        this.element.classList.add('popping');

        // 3. Remove the DOM element after the animation finishes
        this.element.addEventListener('animationend', () => {
            if (this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
        });

        // 4. Immediately remove the bubble from the simulation array
        // This prevents it from being redrawn or interacting with other bubbles
        bubbles = bubbles.filter(b => b !== this);
    }
}

// --- Global Drag Handlers ---
function handleMouseMove(e) {
    if (!draggedBubble) return;
    draggedBubble.hasMoved = true; // A drag is happening
    draggedBubble.x = e.clientX - draggedBubble.dragOffsetX;
    draggedBubble.y = e.clientY - draggedBubble.dragOffsetY;
}

function handleMouseUp() {
    if (draggedBubble) {
        draggedBubble.stopDrag();
        draggedBubble = null;
    }
}

// --- Global Functions ---
function closeDescriptionPopup() {
    const existingPopup = document.querySelector('.description-popup');
    if (existingPopup) {
        existingPopup.classList.remove('visible');
        setTimeout(() => existingPopup.remove(), 300);
    }
    // The specific click listener is removed inside the handler itself
}

// --- Main Physics and Animation Loop ---
let bubbles = [];
let lastTime = 0;
const PHYSICS_SUB_STEPS = 5; // Run collision logic multiple times per frame

function handleBubbleCollisions() {
    for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
            const bubbleA = bubbles[i];
            const bubbleB = bubbles[j];

            const dx = bubbleB.x - bubbleA.x;
            const dy = bubbleB.y - bubbleA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = bubbleA.radius + bubbleB.radius;

            if (distance < minDistance) {
                // 1. Resolve Overlap
                const overlap = minDistance - distance;
                const angle = Math.atan2(dy, dx);
                
                const moveX = (overlap / 2) * Math.cos(angle);
                const moveY = (overlap / 2) * Math.sin(angle);
                
                bubbleA.x -= moveX;
                bubbleA.y -= moveY;
                bubbleB.x += moveX;
                bubbleB.y += moveY;

                // 2. Resolve Collision (Bounce)
                const normalX = dx / distance;
                const normalY = dy / distance;
                
                const relVelX = bubbleA.vx - bubbleB.vx;
                const relVelY = bubbleA.vy - bubbleB.vy;
                
                const velAlongNormal = relVelX * normalX + relVelY * normalY;
                if (velAlongNormal > 0) continue; // Already separating
                
                // If one bubble is dragged, it has "infinite mass"
                if (bubbleA.isBeingDragged) {
                    const impulse = -(1 + RESTITUTION) * velAlongNormal;
                    bubbleB.vx -= impulse * normalX;
                    bubbleB.vy -= impulse * normalY;
                } else if (bubbleB.isBeingDragged) {
                    const impulse = -(1 + RESTITUTION) * velAlongNormal;
                    bubbleA.vx += impulse * normalX;
                    bubbleA.vy += impulse * normalY;
                } else {
                    // Normal collision between two non-dragged bubbles
                    const impulse = -(1 + RESTITUTION) * velAlongNormal / 2;
                    bubbleA.vx += impulse * normalX;
                    bubbleA.vy += impulse * normalY;
                    bubbleB.vx -= impulse * normalX;
                    bubbleB.vy -= impulse * normalY;
                }
            }
        }
    }
}

function animate(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    bubbles.forEach(bubble => bubble.applyPhysics(deltaTime));

    // Run collision multiple times for stability
    for (let i = 0; i < PHYSICS_SUB_STEPS; i++) {
        handleBubbleCollisions();
    }

    bubbles.forEach(bubble => bubble.handleBoundaryCollision());
    bubbles.forEach(bubble => bubble.updatePosition());
    
    bubbles = bubbles.filter(bubble => !bubble.element.classList.contains('popping') || bubble.element.parentNode);
    
    requestAnimationFrame(animate);
}

// --- Initialization ---
function createInitialBubbles() {
    // Create the greeting bubble
    const greetingBubble = createGreetingBubble();
    bubbles.push(greetingBubble);
}

// Function to create a greeting bubble
function createGreetingBubble() {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    const greetingBubble = new Bubble(x, y, "Hey! What are you trying to get done today?", null, true);
    greetingBubble.element.classList.add('greeting-bubble');
    return greetingBubble;
}

function showTaskDescription(taskId, startInEditMode = false) {
    closeDescriptionPopup(); // Close any existing popup first

    const task = tasks[taskId];
    if (!task) {
        console.error('Task not found for ID:', taskId);
        return;
    }

    const popup = document.createElement('div');
    popup.className = 'description-popup';
    
    popup.innerHTML = `
        <div class="popup-header">
            <h3>${task.name}</h3>
            <span class="priority-tag priority-${task.priority.toLowerCase()}">${task.priority}</span>
        </div>
        <p class="popup-description">${task.description}</p>
        <div class="popup-footer">
            <span class="due-date">Due: ${formatDueDate(task.dueDate)}</span>
            <button class="popup-edit-btn">Edit</button>
        </div>
        <button class="popup-close-btn">&times;</button>
    `;

    // --- Event Listeners for new buttons ---
    const editButton = popup.querySelector('.popup-edit-btn');
    const descriptionP = popup.querySelector('.popup-description');
    const header = popup.querySelector('.popup-header');

    const enterEditMode = () => {
        descriptionP.contentEditable = 'true';
        descriptionP.classList.add('editing');
        header.innerHTML = `
            <select id="priority-select" class="popup-edit-select">
                <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
            <div class="due-date">
                Due: 
                <span class="date-input-wrapper">
                    <input type="date" class="popup-edit-select" id="due-date-input" value="${task.dueDate || ''}">
                    <button class="clear-date-btn">×</button>
                </span>
            </div>
        `;
        editButton.textContent = 'Save';

        const clearDateBtn = header.querySelector('.clear-date-btn');
        clearDateBtn.onclick = () => {
            header.querySelector('#due-date-input').value = '';
        };
    };
    
    editButton.addEventListener('click', () => {
        if (editButton.textContent === 'Edit') {
            enterEditMode();
        } else { // Save
            const newPriority = header.querySelector('#priority-select').value;
            const newDueDate = header.querySelector('#due-date-input').value;
            
            // Update the data object
            tasks[taskId].priority = newPriority;
            tasks[taskId].dueDate = newDueDate;
            tasks[taskId].description = descriptionP.textContent;
            
            // Update the view
            editButton.textContent = 'Edit';
            descriptionP.contentEditable = false;
            descriptionP.classList.remove('editing');
            header.innerHTML = `
                <h3>${task.name}</h3>
                <span class="priority-tag priority-${task.priority.toLowerCase()}">${task.priority}</span>
            `;

            // If a bubble exists for this task, update its size
            const bubbleToUpdate = bubbles.find(b => b.taskId === taskId);
            if(bubbleToUpdate) {
                const sizeInfo = calculateBubbleSize(newPriority, newDueDate);
                bubbleToUpdate.radius = sizeInfo.radius;
                bubbleToUpdate.element.style.width = `${sizeInfo.radius * 2}px`;
                bubbleToUpdate.element.style.height = `${sizeInfo.radius * 2}px`;
            }

            renderBubblesForDate(new Date());
            renderCalendar();
        }
    });

    if (startInEditMode) {
        editButton.click();
    }

    // Add to body and position
    document.body.appendChild(popup);
    
    // Dragging logic and positioning would go here, assuming it's still needed.
    // For simplicity, this example removes dragging on the main popup.

    popup.querySelector('.popup-close-btn').addEventListener('click', closeDescriptionPopup);
}

// Function to add new tasks to the system
function addTasksToSystem(newTasks, originalUserInput = '') {
    const today = new Date().toISOString().split('T')[0];
    const userSaidToday = originalUserInput.toLowerCase().includes('today');

    newTasks.forEach((task, index) => {
        // Guard against malformed or empty tasks from the API
        if (!task || !task.name || typeof task.name !== 'string' || task.name.trim() === '') {
            return; // Skip this task
        }

        const taskId = `task-${Date.now()}-${index}`;
        
        // Defensive override: if user says "today" and AI misses it, force today's date.
        let finalDueDate = task.dueDate;
        if (userSaidToday && (!finalDueDate || finalDueDate.trim() === '')) {
            finalDueDate = today;
        }

        tasks[taskId] = {
            id: taskId,
            name: task.name.trim(),
            description: task.description,
            dueDate: finalDueDate,
            priority: task.priority,
            recurrence: task.recurrence || 'none',
            completions: [] // Track completed instances of recurring tasks
        };
    });

    // Rerender bubbles to reflect the new tasks for today
    renderBubblesForDate(new Date());
}

document.addEventListener('DOMContentLoaded', function() {
    createInitialBubbles();
    renderBubblesForDate(new Date()); // Render any tasks due on initial load
    requestAnimationFrame(animate);

    // Add global mouse event listeners for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // --- Day Popup Logic ---
    const dayPopup = document.getElementById('dayPopup');
    const dayPopupDate = document.getElementById('dayPopupDate');
    const dayPopupContent = document.getElementById('dayPopupContent');
    const dayPopupClose = document.getElementById('dayPopupClose');

    function showDayPopup(date) {
        const tasksForDay = Object.values(tasks).filter(task => isTaskDueOn(task, date));
        
        dayPopupDate.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        dayPopupContent.innerHTML = '';

        if (tasksForDay.length > 0) {
            tasksForDay.forEach(task => {
                const taskContainer = document.createElement('div');
                taskContainer.className = 'day-popup-task-container';
                
                const taskElement = document.createElement('div');
                taskElement.classList.add('calendar-task', `priority-${task.priority}`);
                taskElement.textContent = task.name;
                
                const editBtn = document.createElement('button');
                editBtn.className = 'day-popup-edit-btn';
                editBtn.textContent = 'Edit';
                editBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent the day popup from closing
                    hideDayPopup();
                    showTaskDescription(task.id, true); // Directly call the new global function
                };

                taskContainer.appendChild(taskElement);
                taskContainer.appendChild(editBtn);
                dayPopupContent.appendChild(taskContainer);
            });
        } else {
            dayPopupContent.innerHTML = '<p class="no-tasks-message">No tasks for this day.</p>';
        }

        dayPopup.classList.add('visible');
    }

    function hideDayPopup() {
        dayPopup.classList.remove('visible');
    }

    dayPopupClose.addEventListener('click', hideDayPopup);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dayPopup.classList.contains('visible')) {
            hideDayPopup();
        }
    });

    // --- Profile Popup Logic ---
    const profileIcon = document.querySelector('.profile-icon');
    const profilePopup = document.getElementById('profilePopup');
    const profilePopupClose = document.getElementById('profilePopupClose');

    // Show popup when profile icon is clicked
    profileIcon.addEventListener('click', function() {
        profilePopup.classList.add('show');
    });

    // Close popup when close button is clicked
    profilePopupClose.addEventListener('click', function() {
        profilePopup.classList.remove('show');
    });

    // Close popup when clicking outside the popup content
    profilePopup.addEventListener('click', function(e) {
        if (e.target === profilePopup) {
            profilePopup.classList.remove('show');
        }
    });

    // Close popup with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && profilePopup.classList.contains('show')) {
            profilePopup.classList.remove('show');
        }
    });

    // --- Calendar Logic ---
    const datesGrid = document.getElementById('datesGrid');
    const calendarMonthYear = document.getElementById('calendarMonthYear');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const monthViewBtn = document.getElementById('monthViewBtn');
    const weekViewBtn = document.getElementById('weekViewBtn');

    let currentDate = new Date();
    let calendarViewMode = 'month'; // 'month' or 'week'

    function renderCalendar() {
        const calendarContainer = document.querySelector('.calendar-container');

        // Set up the start and end dates based on the view mode
        let startDate, endDate;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        if (calendarViewMode === 'month') {
            startDate = new Date(year, month, 1);
            endDate = new Date(year, month + 1, 0);
            calendarMonthYear.textContent = `${monthNames[month]} ${year}`;
            calendarContainer.classList.remove('week-mode');
        } else { // week mode
            const dayOfWeek = currentDate.getDay();
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - dayOfWeek); // Start of the week (Sunday)
            
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6); // End of the week (Saturday)

            const startMonthName = monthNames[startDate.getMonth()];
            const endMonthName = monthNames[endDate.getMonth()];
            calendarMonthYear.textContent = `${startMonthName} ${startDate.getDate()} - ${endDate.getMonth() !== startDate.getMonth() ? endMonthName + ' ' : ''}${endDate.getDate()}`;
            calendarContainer.classList.add('week-mode');
        }

        datesGrid.innerHTML = '';
        const startDayOfWeek = (calendarViewMode === 'month') ? startDate.getDay() : 0;

        // Add empty cells for days before the 1st of the month
        for (let i = 0; i < startDayOfWeek; i++) {
            const cell = document.createElement('div');
            cell.classList.add('date-cell', 'empty');
            datesGrid.appendChild(cell);
        }

        // Loop from the calculated start date to the end date
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const day = d.getDate();
            const cell = document.createElement('div');
            cell.classList.add('date-cell');
            
            const dayNumber = document.createElement('div');
            dayNumber.classList.add('day-number');
            dayNumber.textContent = day;
            cell.appendChild(dayNumber);

            const thisDate = new Date(d);
            const dateString = `${thisDate.getFullYear()}-${String(thisDate.getMonth() + 1).padStart(2, '0')}-${String(thisDate.getDate()).padStart(2, '0')}`;
            cell.dataset.date = dateString; // Store date on the element
            
            // Add click listener to show day popup
            cell.addEventListener('click', () => {
                if(cell.classList.contains('empty')) return;
                const clickedDate = new Date(cell.dataset.date + 'T00:00:00');
                showDayPopup(clickedDate);
            });

            const today = new Date();
            if (thisDate.toDateString() === today.toDateString()) {
                cell.classList.add('current-day');
            }

            // --- Add tasks to the calendar ---
            Object.values(tasks).forEach(task => {
                if (isTaskDueOn(task, thisDate)) {
                    const taskElement = document.createElement('div');
                    taskElement.classList.add('calendar-task', `priority-${task.priority}`);
                    taskElement.textContent = task.name;
                    cell.appendChild(taskElement);
                }
            });

            datesGrid.appendChild(cell);
        }
    }

    // --- Event Listeners for new controls ---
    prevBtn.addEventListener('click', () => {
        if (calendarViewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentDate.setDate(currentDate.getDate() - 7);
        }
        renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
        if (calendarViewMode === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setDate(currentDate.getDate() + 7);
        }
        renderCalendar();
    });

    monthViewBtn.addEventListener('click', () => {
        calendarViewMode = 'month';
        monthViewBtn.classList.add('active');
        weekViewBtn.classList.remove('active');
        renderCalendar();
    });

    weekViewBtn.addEventListener('click', () => {
        calendarViewMode = 'week';
        weekViewBtn.classList.add('active');
        monthViewBtn.classList.remove('active');
        renderCalendar();
    });

    // --- Mode Toggle Logic ---
    const modeToggle = document.getElementById('modeToggle');
    const bubbleContainer = document.getElementById('bubbleContainer');
    const calendarView = document.getElementById('calendarView');
    let isCalendarMode = false;

    modeToggle.addEventListener('click', function() {
        isCalendarMode = !isCalendarMode;
        
        if (isCalendarMode) {
            // Switch to calendar mode
            document.body.classList.add('calendar-mode');
            modeToggle.classList.add('calendar-mode');
            renderCalendar();
            
            // Pause bubble animations
            bubbles.forEach(bubble => {
                if (bubble.element) {
                    bubble.element.style.animationPlayState = 'paused';
                }
            });
        } else {
            // Switch to task mode
            document.body.classList.remove('calendar-mode');
            modeToggle.classList.remove('calendar-mode');
            
            // Refresh bubbles to ensure they are correct for today
            renderBubblesForDate(new Date());

            // Resume bubble animations
            bubbles.forEach(bubble => {
                if (bubble.element) {
                    bubble.element.style.animationPlayState = 'running';
                }
            });
        }
    });

    // --- Chat Drawer Logic ---
    const drawerHandle = document.querySelector('.drawer-handle');
    const chatDrawer = document.getElementById('chatDrawer');
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const mentorMessage = document.getElementById('mentorMessage');
    const suggestionArea = document.getElementById('suggestionArea');

    drawerHandle.addEventListener('click', () => {
        chatDrawer.classList.toggle('open');
    });

    // Typing effect utility function
    function typeMessage(element, text, speed = 25) {
        element.textContent = '';
        let index = 0;
        
        // Clear any existing interval
        if (element.typingInterval) {
            clearInterval(element.typingInterval);
        }
        
        element.typingInterval = setInterval(() => {
            if (index < text.length) {
                element.textContent += text[index];
                index++;
            } else {
                clearInterval(element.typingInterval);
                element.typingInterval = null;
                sendButton.disabled = false; // Re-enable button after typing is complete
            }
        }, speed);
    }

    const sendMessage = async () => {
        const messageText = chatInput.value.trim();
        if (messageText === '') return;

        // Show loading state and clear old suggestions
        suggestionArea.innerHTML = '';
        mentorMessage.textContent = 'Thinking...';
        chatInput.value = '';
        sendButton.disabled = true;

        try {
            // Generate AI response and tasks
            const [aiResponse, newTasks] = await Promise.all([
                generateAIResponse(messageText),
                generateTasksFromUserInput(messageText)
            ]);

            // Show AI response with typing effect
            typeMessage(mentorMessage, aiResponse);

            // Render new suggestions if any were generated
            if (newTasks && newTasks.length > 0) {
                newTasks.forEach(task => {
                    if (!task || !task.name || task.name.trim() === '') return;

                    const chip = document.createElement('button');
                    chip.className = 'suggestion-chip';
                    chip.textContent = task.name;
                    chip.onclick = () => {
                        addTasksToSystem([task], messageText); // Pass original user input for context
                        
                        // Animate and remove the chip
                        chip.classList.add('removing');
                        setTimeout(() => chip.remove(), 300);
                    };
                    suggestionArea.appendChild(chip);
                });
            }

        } catch (error) {
            console.error('Error processing message:', error);
            typeMessage(mentorMessage, "I'm having a little trouble right now. Let's try again in a moment.");
            sendButton.disabled = false; // Re-enable on error
        }
    };

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !sendButton.disabled) {
            sendMessage();
        }
    });
}); 