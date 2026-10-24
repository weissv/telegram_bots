import type { ReactNode } from 'react';
import { ADMIN_URL, BOT_URL, DEMO_URL, FAQ, FEATURES, PLANS, STEPS } from './content.js';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 border-t border-line py-14 sm:py-20">
      <h2 id={`${id}-title`} className="mb-8 text-[1.75rem] leading-tight sm:text-[2.25rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function App() {
  return (
    <div className="mx-auto max-w-page px-5 sm:px-8">
      <header className="flex items-center justify-between py-5">
        <a href="#top" className="tap font-serif text-xl font-semibold tracking-tight">
          Mirai
        </a>
        <nav aria-label="Основная" className="flex gap-5 text-base">
          <a href="#pricing" className="link tap">
            Тарифы
          </a>
          <a href={ADMIN_URL} className="link tap">
            Войти в админку
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="pb-14 pt-12 sm:pb-20 sm:pt-20">
          <h1 className="max-w-[18ch] text-[clamp(2.25rem,6vw+0.5rem,4rem)] leading-[1.05]">
            Магазин внутри Telegram
          </h1>
          <p className="mt-6 max-w-[64ch]">
            Вы открываете магазин: у покупателей есть бот и витрина Mini App, а у вас — веб-админка
            и сообщение в Telegram о каждом новом заказе. Настройка проходит в чате с ботом.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-7">
            <a href={BOT_URL} className="btn-primary">
              Создать магазин в Telegram
            </a>
            <a href={DEMO_URL} className="link tap">
              Посмотреть демо-витрину
            </a>
          </div>
        </section>

        <Section id="how" title="Как это работает">
          <ol className="max-w-[64ch] space-y-7">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.25rem_1fr] gap-x-2">
                <span className="money pt-0.5 font-serif text-2xl font-semibold text-muted">
                  {i + 1}.
                </span>
                <div>
                  <h3 className="font-sans text-lg font-semibold tracking-normal">{s.title}</h3>
                  <p className="mt-1 text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="included" title="Что входит">
          <dl className="max-w-[64ch]">
            {FEATURES.map((f) => (
              <div key={f.term} className="border-t border-line py-4 first:border-t-0 first:pt-0 sm:grid sm:grid-cols-[13rem_1fr] sm:gap-6">
                <dt className="font-semibold">{f.term}</dt>
                <dd className="mt-1 text-muted sm:mt-0">{f.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="pricing" title="Тарифы">
          <table className="block w-full border-collapse text-left md:table">
            <thead className="sr-only">
              <tr>
                <th scope="col">Тариф</th>
                <th scope="col">Что входит</th>
                <th scope="col">Для кого</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {PLANS.map((p) => (
                <tr
                  key={p.name}
                  className="block border-t border-line py-6 last:border-b md:table-row"
                >
                  <th
                    scope="row"
                    className="block text-left font-normal md:table-cell md:w-[9.5rem] md:py-6 md:pr-6 md:align-top"
                  >
                    <span className="block font-serif text-2xl font-semibold">{p.name}</span>
                    <span className="money mt-1 block">
                      <span className="text-xl font-semibold">{p.price}</span>{' '}
                      <span className="text-base text-muted">{p.period}</span>
                    </span>
                  </th>
                  <td className="mt-4 block text-base md:mt-0 md:table-cell md:py-6 md:pr-6 md:align-top">
                    <ul className="space-y-1.5">
                      {p.included.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span aria-hidden="true" className="text-muted">
                            &ndash;
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="mt-4 block text-base text-muted md:mt-0 md:table-cell md:w-[14rem] md:py-6 md:align-top">
                    {p.forWhom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 max-w-[64ch] text-base text-muted">
            Оформление и выбор тарифа — в боте.{' '}
            <a href={BOT_URL} className="link text-ink">
              Открыть @miraiedu_bot
            </a>
          </p>
        </Section>

        <Section id="faq" title="Вопросы и ответы">
          <div className="max-w-[64ch] border-b border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-t border-line">
                <summary className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4 py-3 font-semibold transition-colors duration-150 hover:text-accent">
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-normal text-muted group-open:hidden"
                  >
                    +
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden shrink-0 font-normal text-muted group-open:inline"
                  >
                    &minus;
                  </span>
                </summary>
                <p className="pb-5 pr-8 text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </Section>
      </main>

      <footer className="flex flex-col gap-1 border-t border-line py-10 text-base sm:flex-row sm:gap-8">
        <a href={BOT_URL} className="link tap">
          Бот @miraiedu_bot
        </a>
        <a href={ADMIN_URL} className="link tap">
          Вход в админку
        </a>
      </footer>
    </div>
  );
}
