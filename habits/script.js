let habits = JSON.parse(localStorage.getItem('habits')) || [];

// Add these event listeners at the start
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('createHabit').addEventListener('click', showHabitModal);
    
    document.getElementById('saveHabit').addEventListener('click', () => {
        const habitName = document.getElementById('habitInput').value.trim();
        if (habitName) {
            const habit = {
                name: habitName,
                checked: new Array(360).fill(false),
                id: Date.now()
            };
            habits.push(habit);
            saveHabits();
            displayHabits();
            hideHabitModal();
        }
    });

    document.getElementById('cancelHabit').addEventListener('click', hideHabitModal);

    document.getElementById('habitModal').addEventListener('click', (e) => {
        if (e.target.id === 'habitModal') {
            hideHabitModal();
        }
    });

    document.getElementById('habitInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('saveHabit').click();
        }
    });
});

function showHabitModal() {
    const modal = document.getElementById('habitModal');
    const input = document.getElementById('habitInput');
    modal.style.display = 'flex';
    input.focus();
    input.value = '';
}

function hideHabitModal() {
    const modal = document.getElementById('habitModal');
    modal.style.display = 'none';
}

function createConfetti(x, y) {
    const colors = [
        '#ff0000', '#ffa500', '#ffff00', '#00ff00', 
        '#00ffff', '#0000ff', '#ff00ff', '#ff69b4'
    ];
    
    const particleCount = 60;  // More particles!

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        
        // Random size between 3px and 7px
        const size = 3 + Math.random() * 4;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // Randomly choose between circle and square
        particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.pointerEvents = 'none';
        particle.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(particle);

        // More dynamic movement
        const angle = Math.random() * Math.PI * 2;
        const velocity = 8 + Math.random() * 6;  // Faster initial velocity
        const friction = 0.9;  // Add friction for more natural movement
        let vx = Math.cos(angle) * velocity;
        let vy = Math.sin(angle) * velocity - 5;  // Initial upward boost
        
        let opacity = 1;
        let rotation = Math.random() * 360;  // Initial rotation
        
        function animate() {
            if (opacity <= 0) {
                particle.remove();
                return;
            }

            // Add gravity
            vy += 0.2;
            
            // Apply friction
            vx *= friction;
            vy *= friction;

            // Update position
            particle.style.left = (parseFloat(particle.style.left) + vx) + 'px';
            particle.style.top = (parseFloat(particle.style.top) + vy) + 'px';
            
            // Spin the particle
            rotation += 5;
            particle.style.transform = `rotate(${rotation}deg)`;

            // Fade out slower
            opacity -= 0.01;
            particle.style.opacity = opacity;

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }
}

function displayHabits() {
    const container = document.getElementById('habitsContainer');
    container.innerHTML = '';

    habits.forEach(habit => {
        const habitDiv = document.createElement('div');
        habitDiv.className = 'habit-container';

        // Create header container for title and delete button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'habit-header';

        const title = document.createElement('h2');
        title.className = 'habit-title';
        title.textContent = habit.name;

        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-button';
        deleteBtn.innerHTML = '×';  // Using × symbol
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${habit.name}"?`)) {
                habits = habits.filter(h => h.id !== habit.id);
                saveHabits();
                displayHabits();
            }
        });

        // Append title and delete button to header
        headerDiv.appendChild(title);
        headerDiv.appendChild(deleteBtn);

        const grid = createHabitGrid(habit);

        // Add progress bar and markers
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        
        // Calculate initial progress
        const checkedCount = habit.checked.filter(Boolean).length;
        const progress = (checkedCount / habit.checked.length) * 100;
        progressBar.style.width = `${progress}%`;

        progressContainer.appendChild(progressBar);

        // Add percentage markers
        const markersDiv = document.createElement('div');
        markersDiv.className = 'progress-markers';
        
        // Create markers for 0%, 25%, 50%, 75%, 100%
        ['0%', '25%', '50%', '75%', '100%'].forEach(mark => {
            const marker = document.createElement('span');
            marker.textContent = mark;
            markersDiv.appendChild(marker);
        });

        // Append everything
        habitDiv.appendChild(headerDiv);  // Add header with title and delete button
        habitDiv.appendChild(grid);
        habitDiv.appendChild(progressContainer);
        habitDiv.appendChild(markersDiv);
        container.appendChild(habitDiv);
    });
}

function createHabitGrid(habit) {
    const habitGrid = document.createElement('div');
    habitGrid.className = 'habit-grid';
    
    // Create 6 rows of 60 boxes each
    for (let row = 0; row < 60; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'habit-row';
        
        for (let col = 0; col < 6; col++) {
            const i = row * 6 + col;  // Calculate the actual index
            if (i >= 360) break; // Safety check

            const box = document.createElement('div');
            box.className = 'box';
            if (habit.checked[i]) {
                box.classList.add('checked');
            }
            
            box.addEventListener('click', (e) => {
                if (!habit.checked[i]) {  // Only trigger confetti when checking the box
                    const rect = box.getBoundingClientRect();
                    createConfetti(rect.left, rect.top);
                }
                
                habit.checked[i] = !habit.checked[i];
                box.classList.toggle('checked');
                
                // Update progress bar
                const habitDiv = box.closest('.habit-container');
                const progressBar = habitDiv.querySelector('.progress-bar');
                const checkedCount = habit.checked.filter(Boolean).length;
                const progress = (checkedCount / habit.checked.length) * 100;
                progressBar.style.width = `${progress}%`;
                
                saveHabits();
            });
            
            rowDiv.appendChild(box);
        }
        
        habitGrid.appendChild(rowDiv);
    }

    return habitGrid;
}


function saveHabits() {
    localStorage.setItem('habits', JSON.stringify(habits));
}




// Display habits on page load
displayHabits();