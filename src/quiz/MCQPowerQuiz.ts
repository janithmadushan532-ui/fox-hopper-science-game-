import { SCIENCE_MCQ, type ScienceMCQ } from './mcqData';

/** Pauses play while the player answers an O/L Science question to earn a power-up. */
export class MCQPowerQuiz {
  readonly root: HTMLDivElement;
  private panel: HTMLDivElement;
  private index = 0;
  private open = false;
  private selectedCorrect = false;
  private readonly onFinish: (correct: boolean) => void;

  constructor(parent: HTMLElement, onFinish: (correct: boolean) => void) {
    this.onFinish = onFinish;
    this.root = document.createElement('div');
    this.root.className = 'fox-quiz-overlay';
    this.root.setAttribute('aria-hidden', 'true');
    this.panel = document.createElement('div');
    this.panel.className = 'fox-quiz-panel';
    this.root.appendChild(this.panel);
    this.root.addEventListener('click', this.onClick);
    parent.appendChild(this.root);
  }

  get isOpen(): boolean { return this.open; }

  showNext(): void {
    const q: ScienceMCQ = SCIENCE_MCQ[this.index % SCIENCE_MCQ.length]!;
    this.index += 1;
    this.open = true;
    this.selectedCorrect = false;
    this.root.classList.add('is-visible');
    this.root.setAttribute('aria-hidden', 'false');
    this.panel.innerHTML = `
      <div class="fox-quiz-top"><span>🦊 FOX POWER CHALLENGE</span><span>${q.grade} · ${q.topic}</span></div>
      <h2>ප්‍රශ්නයට පිළිතුරු දෙන්න!</h2>
      <p class="fox-quiz-question">${this.escape(q.question)}</p>
      <div class="fox-quiz-options">
        ${q.options.map((option, i) => `<button type="button" class="fox-quiz-option" data-answer="${'ABCD'[i]}"><b>${'ABCD'[i]}</b><span>${this.escape(option)}</span></button>`).join('')}
      </div>
      <div class="fox-quiz-feedback" aria-live="polite"></div>
      <button type="button" class="fox-quiz-continue" data-action="continue" hidden>ඉදිරියට යන්න</button>
      <p class="fox-quiz-foot">නිවැරදි පිළිතුරක් = Power-up එකක් ⚡</p>
    `;
    this.panel.dataset.correct = q.correctLetter;
    this.panel.dataset.answer = q.correctAnswer;
    this.panel.dataset.explanation = q.explanation;
  }

  private onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button') as HTMLButtonElement | null;
    if (!button || !this.open) return;
    if (button.dataset.action === 'continue') {
      this.close();
      this.onFinish(this.selectedCorrect);
      return;
    }
    const choice = button.dataset.answer;
    if (!choice || this.panel.querySelector('[data-action="continue"]:not([hidden])')) return;
    const correct = choice === this.panel.dataset.correct;
    this.selectedCorrect = correct;
    this.panel.querySelectorAll<HTMLButtonElement>('.fox-quiz-option').forEach((option) => {
      option.disabled = true;
      if (option.dataset.answer === this.panel.dataset.correct) option.classList.add('is-correct');
      else if (option.dataset.answer === choice) option.classList.add('is-wrong');
    });
    const feedback = this.panel.querySelector<HTMLElement>('.fox-quiz-feedback');
    if (feedback) {
      feedback.className = `fox-quiz-feedback ${correct ? 'good' : 'bad'}`;
      feedback.innerHTML = `${correct ? '🎉 නිවැරදියි! Fox Power ලැබුණා.' : '💡 මේ පිළිතුර නිවැරදි නැහැ.'}<br><strong>නිවැරදි පිළිතුර: ${this.escape(this.panel.dataset.answer ?? '')}</strong><br>${this.escape(this.panel.dataset.explanation ?? '')}`;
    }
    const next = this.panel.querySelector<HTMLButtonElement>('[data-action="continue"]');
    if (next) { next.hidden = false; next.textContent = correct ? '⚡ Power එක ලබාගන්න' : 'ඉදිරියට යන්න'; }
  };

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
  }

  close(): void {
    this.open = false;
    this.root.classList.remove('is-visible');
    this.root.setAttribute('aria-hidden', 'true');
  }

  dispose(): void {
    this.root.removeEventListener('click', this.onClick);
    this.root.remove();
  }
}
