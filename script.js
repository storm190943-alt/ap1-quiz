let questions = [];
let currentQuiz = [];
let currentIndex = 0;
let mode = 'learn';
let score = 0;

async function init() {
    try {
        const res = await fetch('questions.json');
        questions = await res.json();
        populateFilters();
        document.getElementById('start-btn').addEventListener('click', startQuiz);
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                mode = e.target.dataset.mode;
            });
        });
    } catch (e) { console.error("Fehler beim Laden der Fragen:", e); }
}

function populateFilters() {
    const chapters = [...new Set(questions.map(q => q.chapterTitle))];
    const select = document.getElementById('chapter-filter');
    chapters.forEach(title => {
        const opt = document.createElement('option');
        opt.value = title;
        opt.innerText = title;
        select.appendChild(opt);
    });
}

function startQuiz() {
    const filter = document.getElementById('chapter-filter').value;
    currentQuiz = filter === 'all' ? [...questions] : questions.filter(q => q.chapterTitle === filter);
    currentQuiz.sort(() => Math.random() - 0.5);
    currentIndex = 0; score = 0;
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');
    showQuestion();
}

function showQuestion() {
    const q = currentQuiz[currentIndex];
    document.getElementById('question-text').innerText = q.question;
    document.getElementById('question-meta').innerText = `${q.chapterTitle} | ${q.topicTitle}`;
    document.getElementById('progress-text').innerText = `Frage: ${currentIndex + 1}/${currentQuiz.length}`;
    
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.innerHTML = `<input type="${q.type === 'multi' ? 'checkbox' : 'radio'}" name="ans" value="${idx}"> ${opt}`;
        div.onclick = () => {
            if(q.type === 'single') container.querySelectorAll('.option-item').forEach(i => i.classList.remove('selected'));
            div.classList.toggle('selected');
        };
        container.appendChild(div);
    });
    document.getElementById('feedback-area').classList.add('hidden');
    document.getElementById('check-btn').classList.remove('hidden');
    document.getElementById('next-btn').classList.add('hidden');
}

document.getElementById('check-btn').onclick = () => {
    const q = currentQuiz[currentIndex];
    const selected = Array.from(document.querySelectorAll('input[name="ans"]:checked')).map(i => parseInt(i.value));
    if(selected.length === 0) return alert("Bitte wähle eine Antwort!");

    const isCorrect = JSON.stringify(selected.sort()) === JSON.stringify(q.correctAnswers.sort());
    if(isCorrect) score++;

    if(mode === 'learn') {
        showFeedback(isCorrect, q);
    } else {
        nextQuestion();
    }
};

function showFeedback(isCorrect, q) {
    const area = document.getElementById('feedback-area');
    area.classList.remove('hidden');
    document.getElementById('explanation-box').innerText = q.explanation;
    document.getElementById('feedback-text').innerHTML = isCorrect ? "<b style='color:green'>Richtig!</b>" : "<b style='color:red'>Falsch!</b>";
    document.getElementById('check-btn').classList.add('hidden');
    document.getElementById('next-btn').classList.remove('hidden');
}

document.getElementById('next-btn').onclick = nextQuestion;

function nextQuestion() {
    currentIndex++;
    if(currentIndex < currentQuiz.length) showQuestion();
    else {
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('result-screen').classList.remove('hidden');
        document.getElementById('score-display').innerText = `Ergebnis: ${score} von ${currentQuiz.length} richtig.`;
    }
}
init();
