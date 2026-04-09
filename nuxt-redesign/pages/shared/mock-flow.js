(function () {
  const path = (window.location.pathname || '').toLowerCase();
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const routes = {
    course: '../06_learning/index.html',
    confirm: '../07_pre-test-confirm/index.html',
    pretest: '../08_pre-test/index.html',
    exam: '../09_exam/index.html',
    failed: '../10_result-failed/index.html',
    payment: '../11_payment/index.html',
    success: '../12_result-success/index.html',
    certificate: '../13_certificate/index.html',
    pending: '../14_payment-pending/index.html',
    overview: '../15_overview/index.html',
    learning: '../06_learning/index.html',
    catalog: '../04_catalog/index.html',
    selection: '../03_wizard/index.html',
    home: '../01_index/index.html',
  };

  const byText = (text, root = document) =>
    [...root.querySelectorAll('button, a, label')].find((el) => normalize(el.textContent).includes(normalize(text)));

  const setHref = (text, href, root = document) => {
    const node = byText(text, root);
    if (node) {
      node.href = href;
      node.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = href;
      });
    }
  };

  const setButton = (text, handler, root = document) => {
    const node = byText(text, root);
    if (node) {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        handler(node, event);
      });
    }
  };

  const initCoursePage = () => {
    setButton('Start Training', () => {
      window.location.href = routes.course;
    });
    setButton('Download Syllabus', () => {
      window.location.href = routes.course;
    });
  };

  const initLearningPage = () => {
    const progressLabel = [...document.querySelectorAll('header *')].find((el) => normalize(el.textContent) === '45%');
    if (progressLabel) {
      progressLabel.textContent = '67%';
    }

    setButton('Back', () => {
      window.location.href = routes.catalog;
    });
    setButton('Save & Exit', () => {
      window.location.href = routes.overview;
    });
    setButton('Next Section', () => {
      window.location.href = routes.confirm;
    });
  };

  const initConfirmPage = () => {
    const checkbox = document.querySelector('input[type="checkbox"]');
    const continueButton = byText('Перейти к тестированию');
    const backButton = byText('Вернуться к модулям');

    const sync = () => {
      if (!continueButton) return;
      continueButton.style.opacity = checkbox && checkbox.checked ? '1' : '0.5';
      continueButton.style.pointerEvents = checkbox && checkbox.checked ? 'auto' : 'none';
    };

    if (checkbox) {
      checkbox.addEventListener('change', sync);
      sync();
    }

    setButton('Перейти к тестированию', () => {
      if (checkbox && !checkbox.checked) return;
      window.location.href = routes.pretest;
    });

    if (backButton) {
      backButton.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = routes.learning;
      });
    }
  };

  const initPreTestPage = () => {
    setButton('Start Test', () => {
      window.location.href = routes.exam;
    });
    setButton('Back to material', () => {
      window.location.href = routes.learning;
    });
  };

  const initExamPage = () => {
    const questions = [
      {
        question: 'Какой документ фиксирует первичный допуск работника к опасным работам?',
        options: ['Устное согласование', 'Наряд-допуск', 'Памятка по смене', 'Служебная записка'],
        answerIndex: 1,
      },
      {
        question: 'Что нужно сделать перед началом работ в замкнутом объёме?',
        options: ['Открыть все двери', 'Оценить атмосферу и обеспечить контроль среды', 'Сразу включить оборудование', 'Остановить журналирование'],
        answerIndex: 1,
      },
      {
        question: 'Кто должен подтверждать обучение и ознакомление с материалами?',
        options: ['Только HR', 'Сам сотрудник и ответственное лицо', 'Только подрядчик', 'Поставщик оборудования'],
        answerIndex: 1,
      },
      {
        question: 'Какой шаг снижает риск ошибок перед экзаменом?',
        options: ['Пропустить инструкции', 'Проверить модули и пройти подтверждение', 'Сразу перейти к оплате', 'Отключить историю'],
        answerIndex: 1,
      },
      {
        question: 'Что обычно входит в обязательный пакет документов?',
        options: ['Наряд-допуск, протокол, журнал инструктажа', 'Только паспорт', 'Письмо от коллеги', 'Скриншот оплаты'],
        answerIndex: 0,
      },
      {
        question: 'Как лучше действовать при смене отрасли или объекта?',
        options: ['Оставить старые настройки', 'Подобрать новую связку отрасль + профиль риска', 'Отключить тест', 'Удалить кабинет'],
        answerIndex: 1,
      },
      {
        question: 'Что показывает review-экран перед стартом обучения?',
        options: ['Только цену', 'Выбор, количество программ, документы и следующий шаг', 'Только логотип', 'Только отзывы'],
        answerIndex: 1,
      },
      {
        question: 'Какой вариант подходит для ИТР и ответственных специалистов?',
        options: ['Вариант без подтверждения', 'Программы с управленческим и нормативным контекстом', 'Только рабочие инструкции', 'Только визуальные инструкции'],
        answerIndex: 1,
      },
      {
        question: 'Что делает mock payment в новом flow?',
        options: ['Ничего не меняет', 'Переводит в success или pending без эквайринга', 'Останавливает процесс', 'Удаляет сертификат'],
        answerIndex: 1,
      },
      {
        question: 'Что нужно, чтобы кабинет был полезным?',
        options: ['Пустая таблица', 'Статус, история, прогресс и документ', 'Только banner', 'Только кнопка выхода'],
        answerIndex: 1,
      },
    ];

    const leftColumn = document.querySelector('main > div');
    if (!leftColumn) return;

    const headline = leftColumn.querySelector('h2');
    const explanation = leftColumn.querySelector('.bg-black\\/20.p-4.rounded-lg.border.border-white\\/5.flex.items-start.gap-3 p');
    const optionButtons = [...leftColumn.querySelectorAll('.grid.grid-cols-1.gap-4 > button')];
    const counter = document.querySelector('header .text-2xl.font-black');
    const navGrid = document.querySelector('aside .grid.grid-cols-5');
    const prevButton = byText('Previous');
    const nextButton = byText('Next');
    const submitButton = byText('Submit Exam');
    const answerState = new Map();
    let activeIndex = 0;

    if (counter) {
      counter.textContent = `1 of ${questions.length}`;
    }

    const renderNav = () => {
      if (!navGrid) return;
      navGrid.innerHTML = '';
      questions.forEach((_, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'w-full aspect-square flex items-center justify-center rounded-md text-sm font-bold transition-all';
        const answered = answerState.has(index);
        if (index === activeIndex) {
          button.className += ' bg-primary text-white ring-4 ring-secondary/30';
        } else if (answered) {
          button.className += ' bg-secondary-container text-on-secondary-container shadow-sm';
        } else {
          button.className += ' bg-white border border-outline-variant text-outline font-medium';
        }
        button.textContent = String(index + 1);
        button.addEventListener('click', () => {
          activeIndex = index;
          renderQuestion();
        });
        navGrid.appendChild(button);
      });
    };

    const renderQuestion = () => {
      const question = questions[activeIndex];
      if (!question) return;

      if (headline) {
        headline.textContent = question.question;
      }
      if (counter) {
        counter.textContent = `${activeIndex + 1} of ${questions.length}`;
      }
      if (explanation) {
        explanation.textContent = 'Выберите ответ и продолжайте к следующему вопросу. В экзамене используется единый моковый банк на 10 вопросов.';
      }

      optionButtons.forEach((button, optionIndex) => {
        const active = answerState.get(activeIndex) === optionIndex;
        const letter = String.fromCharCode(65 + optionIndex);
        button.className = active
          ? 'flex items-center gap-4 rounded-2xl border p-4 text-left transition-all border-[#4A90E2] bg-[#0f2240]'
          : 'flex items-center gap-4 rounded-2xl border p-4 text-left transition-all border-white/10 bg-white/5 hover:border-white/20';
        button.innerHTML = `
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-sm font-black uppercase">${letter}</div>
          <div class="flex-1 text-sm leading-relaxed text-slate-200">${question.options[optionIndex]}</div>
        `;
        button.onclick = () => {
          answerState.set(activeIndex, optionIndex);
          renderQuestion();
        };
      });

      renderNav();
    };

    if (prevButton) {
      prevButton.addEventListener('click', (event) => {
        event.preventDefault();
        activeIndex = Math.max(0, activeIndex - 1);
        renderQuestion();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', (event) => {
        event.preventDefault();
        activeIndex = Math.min(questions.length - 1, activeIndex + 1);
        renderQuestion();
      });
    }

    if (submitButton) {
      submitButton.addEventListener('click', (event) => {
        event.preventDefault();
        const correct = questions.reduce((total, question, index) => total + ((answerState.get(index) ?? -1) === question.answerIndex ? 1 : 0), 0);
        const score = Math.round((correct / questions.length) * 100);
        const passed = score >= 80;
        window.location.href = passed
          ? `${routes.success}?score=${score}&passed=1`
          : `${routes.failed}?score=${score}&passed=0`;
      });
    }

    renderQuestion();
  };

  const initFailedPage = () => {
    setButton('Оплатить дополнительную попытку', () => {
      window.location.href = routes.payment;
    });
    setButton('Учебные материалы', () => {
      window.location.href = routes.learning;
    });
    setButton('Консультация менеджера', () => {
      window.location.href = routes.learning;
    });
  };

  const initPaymentPage = () => {
    const radios = [...document.querySelectorAll('input[name="payment"]')];
    const payButton = [...document.querySelectorAll('button')].find((button) => normalize(button.textContent).includes('оплатить') || normalize(button.textContent).includes('confirm payment'));

    const selectedMethod = () => {
      const checked = radios.find((radio) => radio.checked);
      const label = checked?.closest('label');
      return normalize(label?.textContent || '');
    };

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        radios.forEach((item) => (item.checked = item === radio));
      });
    });

    if (payButton) {
      payButton.addEventListener('click', (event) => {
        event.preventDefault();
        const method = selectedMethod();
        const pending = method.includes('bank') || method.includes('qr') || method.includes('invoice');
        window.location.href = pending ? routes.pending : routes.success;
      });
    }
  };

  const initSuccessPage = () => {
    setButton('Proceed to Payment', () => {
      window.location.href = routes.payment;
    });
    setButton('Download detailed report', () => {
      window.location.href = routes.certificate;
    });
    setButton('Go to Personal Cabinet', () => {
      window.location.href = routes.overview;
    });
  };

  const initCertificatePage = () => {
    setButton('Go to Cabinet', () => {
      window.location.href = routes.overview;
    });
    setButton('Check status later', () => {
      window.location.href = routes.pending;
    });
    setButton('Contact Support', () => {
      window.location.href = routes.overview;
    });
  };

  const initPendingPage = () => {
    setButton('Go to Cabinet', () => {
      window.location.href = routes.overview;
    });
    setButton('Check status later', () => {
      window.location.href = routes.overview;
    });
  };

  const initOverviewPage = () => {
    setButton('Continue Learning', () => {
      window.location.href = routes.learning;
    });
    setButton('Explore Courses', () => {
      window.location.href = routes.catalog;
    });
    setButton('Quick Renew', () => {
      window.location.href = routes.course;
    });
    setButton('Start Renewal', () => {
      window.location.href = routes.course;
    });
  };

  if (path.includes('/05_course/')) initCoursePage();
  if (path.includes('/06_learning/')) initLearningPage();
  if (path.includes('/07_pre-test-confirm/')) initConfirmPage();
  if (path.includes('/08_pre-test/')) initPreTestPage();
  if (path.includes('/09_exam/')) initExamPage();
  if (path.includes('/10_result-failed/')) initFailedPage();
  if (path.includes('/11_payment/')) initPaymentPage();
  if (path.includes('/12_result-success/')) initSuccessPage();
  if (path.includes('/13_certificate/')) initCertificatePage();
  if (path.includes('/14_payment-pending/')) initPendingPage();
  if (path.includes('/15_overview/')) initOverviewPage();
})();
