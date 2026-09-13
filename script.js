/* 
  Pomodoro Timer — script.js
  © 2026 Rohini Devi Beegoo. All rights reserved.
*/
(function() {
    const CX = 150, CY = 150, R = 118;
    const MIN_MINUTES = 1, MAX_MINUTES = 60;
    const BREAK_SECONDS = 5 * 60;
    const LONG_BREAK_SECONDS = 15 * 60;

    const dialWrap = document.getElementById('dialWrap');
    const dialSvg = document.getElementById('dialSvg');
    const handle = document.getElementById('handle');
    const ringProgress = document.getElementById('ringProgress');
    const readout = document.getElementById('readout');
    const modeLabel = document.getElementById('modeLabel');
    const hint = document.getElementById('hint');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const dotsWrap = document.getElementById('dots');
    const taskInput = document.getElementById('taskInput');
    const ticksGroup = document.getElementById('ticks');

    const CIRC = 2 * Math.PI * R;
    ringProgress.style.strokeDasharray = CIRC;

    let mode = 'focus'; // 'focus' | 'break' | 'longBreak'
    let durationSeconds = 25 * 60; // chosen duration for focus (idle)
    let remaining = durationSeconds;
    let running = false;
    let timerId = null;
    let sessionsCompleted = 0;

    // --- build tick marks ---
    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * 360;
        const isMajor = i % 5 === 0;
        const rOuter = R + 8;
        const rInner = isMajor ? R - 8 : R - 3;
        const rad = (angle - 90) * Math.PI / 180;

        const x1 = CX + rOuter * Math.cos(rad);
        const y1 = CY + rOuter * Math.sin(rad);
        const x2 = CX + rInner * Math.cos(rad);
        const y2 = CY + rInner * Math.sin(rad);

        const line = document.createElementNS('http://www.w3.org/2000/svg','line');

        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('class', 'tick' + (isMajor ? ' major' : ''));
        ticksGroup.appendChild(line);
    }

    function minutesToAngle(min) {
        return (min / MAX_MINUTES) * 360;
    }

    function angleToMinutes(angle) {
        let m = Math.round((angle / 360) * MAX_MINUTES);
        if (m < MIN_MINUTES) m = MIN_MINUTES;
        if (m > MAX_MINUTES) m = MAX_MINUTES;
        return m;
    }

    function setHandleAtAngle(angle) {
        const rad = (angle - 90) * Math.PI / 180;
        const x = CX + R * Math.cos(rad);
        const y = CY + R * Math.sin(rad);

        handle.setAttribute('cx', x);
        handle.setAttribute('cy', y);
    }

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;

        return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }

    function currentModeMax() {
        if (mode === 'focus') return durationSeconds;
        if (mode === 'break') return BREAK_SECONDS;

        return LONG_BREAK_SECONDS;
    }

    function applyModeColors() {
        const root = document.documentElement.style;

        if (mode === 'focus') {
            root.setProperty('--accent', 'var(--tomato)');
            root.setProperty('--accent-dark', 'var(--tomato-dark)');
            modeLabel.textContent = 'focus';
        } else if (mode === 'break') {
            root.setProperty('--accent', 'var(--stem)');
            root.setProperty('--accent-dark', 'var(--stem-dark)');
            modeLabel.textContent = 'short break';
        } else {
            root.setProperty('--accent', 'var(--stem)');
            root.setProperty('--accent-dark', 'var(--stem-dark)');
            modeLabel.textContent = 'long break';
        }
    }

    function render() {
        readout.textContent = formatTime(remaining);

        const max = currentModeMax();
        const fraction = running || remaining !== max ? remaining / max : 1;
        const offset = CIRC * (1 - fraction);

        ringProgress.style.strokeDashoffset = offset;

        if (!running) {
            // idle: handle reflects chosen minutes (only meaningful in focus mode)
            const minutesShown = mode === 'focus' ? Math.round(remaining / 60) : Math.round(max/60);
            setHandleAtAngle(minutesToAngle(minutesShown));
        } else {
            const angle = 360 * fraction;
            setHandleAtAngle(angle);
        }

        startBtn.textContent = running ? 'Pause' : (remaining === currentModeMax() ? 'Start' : 'Resume');
        hint.style.opacity = running ? '0' : '1';
        dialSvg.setAttribute('aria-valuenow', Math.round(remaining/60));
    }

    function renderDots() {
        dotsWrap.innerHTML = '';

        const totalToShow = 4;
        const filledCount = sessionsCompleted % 4 === 0 && sessionsCompleted > 0 ? 4 : sessionsCompleted % 4;

        for (let i = 0; i < totalToShow; i++) {
            const d = document.createElement('div');
            d.className = 'dot' + (i < filledCount ? ' filled' : '');
            dotsWrap.appendChild(d);
        }

        const label = document.createElement('span');

        label.className = 'dots-label';
        label.textContent = sessionsCompleted + ' completed';
        dotsWrap.appendChild(label);
    }

    // --- beep ---
    function beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;

            [0, 0.18, 0.36].forEach((t, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = i === 2 ? 880 : 660;

                gain.gain.setValueAtTime(0.0001, now + t);
                gain.gain.exponentialRampToValueAtTime(0.15, now + t + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.15);

                osc.connect(gain).connect(ctx.destination);
                osc.start(now + t);
                osc.stop(now + t + 0.16);
            });

        } catch(e){ /* audio not available, ignore */ }
    }

    function tick() {
        remaining -= 1;

        if (remaining <= 0){
            remaining = 0;
            render();
            completeSession();
            return;
        }

        render();
    }

    function completeSession() {
        running = false;
        clearInterval(timerId);
        beep();

        if (mode === 'focus') {
            sessionsCompleted += 1;
            renderDots();

            if (sessionsCompleted % 4 === 0) {
                mode = 'longBreak';
                remaining = LONG_BREAK_SECONDS;
            } else {
                mode = 'break';
                remaining = BREAK_SECONDS;
            }

        } else {
            mode = 'focus';
            remaining = durationSeconds;
        }

        applyModeColors();
        render();
    }

    function startPause() {
        if (running) {
            running = false;
            clearInterval(timerId);
            render();
            return;
        }

        running = true;
        timerId = setInterval(tick, 1000);
        render();
    }

    function reset() {
        running = false;
        clearInterval(timerId);
        mode = 'focus';
        remaining = durationSeconds;
        applyModeColors();
        render();
    }

    // --- dial dragging (only when idle, focus mode) ---
    let dragging = false;

    function angleFromEvent(clientX, clientY) {
        const rect = dialSvg.getBoundingClientRect();
        const scale = 300 / rect.width;

        const x = (clientX - rect.left) * scale - CX;
        const y = (clientY - rect.top) * scale - CY;

        let deg = Math.atan2(y, x) * 180 / Math.PI + 90;

        if (deg < 0) deg += 360;
        return deg;
    }

    function canDrag() {
        return !running && mode === 'focus';
    }

    function pointerDown(e) {
        if (!canDrag()) return;

        dragging = true;
        movePointer(e);
        e.preventDefault();
    }

    function movePointer(e) {
        if (!dragging || !canDrag()) return;

        const point = e.touches ? e.touches[0] : e;
        const angle = angleFromEvent(point.clientX, point.clientY);
        const minutes = angleToMinutes(angle);

        durationSeconds = minutes * 60;
        remaining = durationSeconds;
        render();
    }

    function pointerUp() {
        dragging = false;
    }

    dialWrap.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', movePointer);
    window.addEventListener('pointerup', pointerUp);

    // keyboard control of dial when focused
    dialSvg.addEventListener('keydown', (e) => {
        if (!canDrag()) return;
        let minutes = Math.round(durationSeconds / 60);

        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            minutes = Math.min(MAX_MINUTES, minutes + 1);
            e.preventDefault();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            minutes = Math.max(MIN_MINUTES, minutes - 1);
            e.preventDefault();
        } else {
            return;
        }

        durationSeconds = minutes * 60;
        remaining = durationSeconds;
        render();
    });

    startBtn.addEventListener('click', startPause);
    resetBtn.addEventListener('click', reset);

    document.addEventListener('keydown', (e) => {
        if (e.target === taskInput) return;

        if (e.code === 'Space') {
            e.preventDefault();
            startPause();
        } else if (e.key.toLowerCase() === 'r') {
            reset();
        }
    });

    applyModeColors();
    render();
    renderDots();
})();