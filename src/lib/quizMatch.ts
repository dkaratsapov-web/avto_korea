/**
 * Подбор авто под ответы квиза — с близкими вариантами, а не «ничего нет».
 *
 * Жёсткий фильтр по всем четырём ответам сразу почти всегда даёт пусто:
 * в наличии 165 машин, а сочетаний бюджет × кузов × страна × состояние —
 * многие сотни. Человек проходил пять шагов и получал «точного совпадения
 * нет» — то есть ничего. Это худший из возможных финалов: он прошёл квиз
 * до конца, значит был готов, а мы не показали ни одной машины.
 *
 * Поэтому условия не отбрасываются, а ослабляются по очереди — от наименее
 * важного к самому важному. Порядок не случаен:
 *
 *   1. состояние — «новое или с пробегом» люди меняют легче всего, если
 *      машина в остальном подходит;
 *   2. страна — большинству важна машина, а не порт отправления;
 *   3. кузов — уже существеннее: седан вместо кроссовера устроит не всех;
 *   4. бюджет — трогаем последним и не отбрасываем, а расширяем на четверть:
 *      «чуть дороже» обсуждаемо, «вдвое дороже» — нет.
 *
 * Возвращаем не только машины, но и список того, что пришлось ослабить:
 * без честной подписи «ближе всего, но из Кореи» подборка выглядит так,
 * будто мы не поняли ответы.
 */

export type QuizCar = {
  priceRub: number;
  priceTverRub?: number;
  bodyType?: string;
  country: string;
  isNew?: boolean;
};

export type QuizAnswers = {
  /** Границы бюджета. Отсутствие — «бюджет не указан». */
  budgetMin?: number;
  budgetMax?: number;
  /** Кузов, страна: пусто или «any» означает «не важно». */
  body?: string;
  country?: string;
  condition?: "new" | "used" | "any";
};

export type QuizMatch<T> = {
  cars: T[];
  /** Все ответы соблюдены. */
  exact: boolean;
  /** Что пришлось ослабить — человеческим языком, для подписи под списком. */
  relaxed: string[];
};

/** Насколько бюджет расширяется на последнем шаге. */
const BUDGET_STRETCH = 0.25;

function priceOf(car: QuizCar): number {
  return car.priceTverRub ?? car.priceRub;
}

/** Задано ли условие вообще. «any» и пусто — это «не важно». */
function isSet(value: string | undefined): boolean {
  return Boolean(value) && value !== "any";
}

export function matchQuizCars<T extends QuizCar>(
  cars: T[],
  answers: QuizAnswers,
): QuizMatch<T> {
  /*
   * Достаточно одной границы.
   *
   * Верхняя ступень бюджета в квизе — «2,5 млн и больше», у неё верхней
   * границы нет вовсе. Пока требовались обе, такой ответ считался за
   * «бюджет не указан», и в подбор лезли машины за 1,8 млн — прямо
   * противоположные тому, что человек выбрал.
   */
  const hasBudget =
    typeof answers.budgetMin === "number" || typeof answers.budgetMax === "number";
  const budgetMin = typeof answers.budgetMin === "number" ? answers.budgetMin : 0;
  const budgetMax =
    typeof answers.budgetMax === "number" ? answers.budgetMax : Infinity;

  /**
   * Проверка с набором отключённых условий.
   *
   * stretch — во сколько раз расширены границы бюджета: 0 значит «как
   * ответили».
   */
  const select = (
    off: { condition?: boolean; country?: boolean; body?: boolean },
    stretch: number,
  ): T[] =>
    cars.filter((car) => {
      if (hasBudget) {
        // Бесконечность при умножении остаётся бесконечностью — открытую
        // сверху ступень расширение бюджета не ломает.
        const min = budgetMin * (1 - stretch);
        const max = budgetMax * (1 + stretch);
        const price = priceOf(car);
        if (price < min || price > max) return false;
      }
      if (!off.body && isSet(answers.body) && car.bodyType !== answers.body) {
        return false;
      }
      if (!off.country && isSet(answers.country) && car.country !== answers.country) {
        return false;
      }
      if (!off.condition && isSet(answers.condition)) {
        if (answers.condition === "new" && !car.isNew) return false;
        if (answers.condition === "used" && car.isNew) return false;
      }
      return true;
    });

  const exact = select({}, 0);
  if (exact.length) {
    return { cars: exact, exact: true, relaxed: [] };
  }

  /*
   * Ступени ослабления. Каждая следующая включает все предыдущие: если
   * не помогло снятие состояния, снимаем ещё и страну, и так далее.
   * Подписи — только для тех условий, которые человек действительно задал:
   * писать «подобрали без учёта страны», когда он выбрал «не важно», значит
   * извиняться за то, о чём не спрашивали.
   */
  const steps: { off: Parameters<typeof select>[0]; stretch: number; label: string; when: boolean }[] = [
    {
      off: { condition: true },
      stretch: 0,
      label: "состояния",
      when: isSet(answers.condition),
    },
    {
      off: { condition: true, country: true },
      stretch: 0,
      label: "страны",
      when: isSet(answers.country),
    },
    {
      off: { condition: true, country: true, body: true },
      stretch: 0,
      label: "кузова",
      when: isSet(answers.body),
    },
    {
      off: { condition: true, country: true, body: true },
      stretch: BUDGET_STRETCH,
      label: "бюджета",
      when: hasBudget,
    },
  ];

  const relaxed: string[] = [];
  for (const step of steps) {
    // Ступень, которой человек не задавал, ничего не изменит — пропускаем,
    // чтобы не попасть в подпись зря.
    if (!step.when) continue;
    relaxed.push(step.label);

    const found = select(step.off, step.stretch);
    if (found.length) {
      return { cars: sortByBudget(found, answers), exact: false, relaxed };
    }
  }

  return { cars: [], exact: false, relaxed };
}

/**
 * Ближе к бюджету — выше.
 *
 * Внутри ослабленной выборки порядок каталога бесполезен: сверху окажется
 * то, что добавили последним, а не то, что ближе к запросу.
 */
function sortByBudget<T extends QuizCar>(cars: T[], answers: QuizAnswers): T[] {
  const min = typeof answers.budgetMin === "number" ? answers.budgetMin : null;
  const max =
    typeof answers.budgetMax === "number" && Number.isFinite(answers.budgetMax)
      ? answers.budgetMax
      : null;
  if (min === null && max === null) {
    return cars;
  }
  // У открытой сверху ступени середины нет — целимся в нижнюю границу:
  // «2,5 млн и больше» значит, что ближе к 2,5 млн интереснее.
  const target = min !== null && max !== null ? (min + max) / 2 : (min ?? max) as number;
  return [...cars].sort(
    (a, b) => Math.abs(priceOf(a) - target) - Math.abs(priceOf(b) - target),
  );
}

/** Подпись под списком: что именно мы ослабили. */
export function relaxedLabel(relaxed: string[]): string {
  if (relaxed.length === 0) return "";
  if (relaxed.length === 1) return `Точного совпадения нет — показываем близкое, без учёта ${relaxed[0]}`;
  const last = relaxed[relaxed.length - 1];
  const head = relaxed.slice(0, -1).join(", ");
  return `Точного совпадения нет — показываем близкое, без учёта ${head} и ${last}`;
}
