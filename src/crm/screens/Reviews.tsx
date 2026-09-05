/**
 * Отзывы сайта.
 *
 * Пульт, а не хранилище: отзывы публикует бот (владелец пересылает ему видео
 * с выдачи), а сайт и мини-апп их показывают. Здесь видно, что именно сейчас
 * стоит на витрине, и отсюда лишнее убирается.
 *
 * Раздел появился потому, что до сих пор удалять отзыв можно было только в
 * админке бота — с телефона, внутри Telegram, через кнопку мини-аппа. Кнопка
 * однажды сломалась, и владелец остался без доступа к собственной витрине.
 */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link2, Play, RefreshCw, Star, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../auth";
import { formatMoment, plural } from "../lib/format";
import type { SiteReview } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Spinner, useToast } from "../ui";
import { PageHead } from "./Layout";

/** Все файлы отзыва одним списком: видео вперёд, затем фото. */
function slidesOf(r: SiteReview): { type: "video" | "image"; src: string }[] {
  const videos = r.videos?.length ? r.videos : r.video ? [r.video] : [];
  const images = r.images?.length ? r.images : r.media ? [r.media] : [];
  return [
    ...videos.map((src) => ({ type: "video" as const, src })),
    ...images.map((src) => ({ type: "image" as const, src })),
  ];
}

/**
 * Заголовок карточки — что за машину выдали.
 *
 * Текст приходит из Telegram как есть, вместе со служебными строками
 * («Клиент: …», приглашение написать менеджеру). В списке нужна только модель:
 * по ней владелец и узнаёт отзыв, который собрался удалить.
 */
function title(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/выдач[аи]\s*[:—-]?\s*(.+)$/i);
    if (m) return m[1].replace(/[«»"']/g, "").trim().slice(0, 60);
  }
  const junk = /клиент\s*[:—-]|пришел|пришёл|по\s*ссылке|напишите|подбер[её]м|@[a-z0-9_]/i;
  const first = lines.find((l) => !junk.test(l));
  return first ? first.slice(0, 80) : "Без подписи";
}

export function Reviews() {
  const { isOwner } = useAuth();
  const toast = useToast();

  const [reviews, setReviews] = useState<SiteReview[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [watch, setWatch] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown) => toast(e instanceof ApiError ? e.message : "Не удалось", "error"),
    [toast],
  );

  const load = useCallback(() => {
    api
      .reviews()
      .then((r) => {
        setConnected(r.connected);
        setReviews(r.reviews);
      })
      .catch((e) => {
        setReviews([]);
        fail(e);
      });
  }, [fail]);

  useEffect(load, [load]);

  const remove = async (r: SiteReview) => {
    if (!window.confirm(`Удалить отзыв «${title(r.text)}»? С сайта он исчезнет сразу.`)) return;
    setBusy(true);
    try {
      const result = await api.deleteReview(r.id);
      setReviews(result.reviews);
      toast("Отзыв удалён");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    if (!window.confirm("Удалить все отзывы? Вернуть их можно только пересылкой в бота заново.")) {
      return;
    }
    setBusy(true);
    try {
      const result = await api.deleteAllReviews();
      setReviews(result.reviews);
      toast("Отзывы удалены");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (reviews === null) return <Spinner />;

  if (!connected) {
    return (
      <>
        <PageHead title="Отзывы сайта" subtitle="Раздел ещё не подключён к боту" />
        <Connect
          isOwner={isOwner}
          onDone={(list) => {
            setConnected(true);
            setReviews(list);
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Отзывы сайта"
        subtitle={
          reviews.length
            ? `${reviews.length} ${plural(reviews.length, ["отзыв", "отзыва", "отзывов"])} на витрине`
            : "Публикует бот — пересылкой видео с выдачи"
        }
        action={
          <div className="flex gap-2">
            <Button onClick={load} title="Обновить">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isOwner && reviews.length ? (
              <Button variant="danger" onClick={removeAll} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                Удалить все
              </Button>
            ) : null}
          </div>
        }
      />

      {reviews.length === 0 ? (
        <Empty
          title="Отзывов на сайте нет"
          hint="Перешлите боту видео с выдачи — он опубликует его на сайте и в мини-аппе."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reviews.map((r) => {
            const slides = slidesOf(r);
            const video = slides.find((s) => s.type === "video");
            const cover = r.poster || r.images?.[0] || r.media || slides.find((s) => s.type === "image")?.src;

            return (
              <Card key={r.id} className="overflow-hidden !p-0">
                <div className="relative aspect-video bg-crm-soft">
                  {cover ? (
                    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[12.5px] text-crm-ink-3">
                      Без файлов
                    </div>
                  )}
                  {video ? (
                    <button
                      type="button"
                      onClick={() => setWatch(video.src)}
                      title="Посмотреть видео"
                      className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/40"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg">
                        <Play className="ml-0.5 h-5 w-5 fill-crm-accent text-crm-accent" />
                      </span>
                    </button>
                  ) : null}
                  {slides.length > 1 ? (
                    <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                      {slides.length} файла
                    </span>
                  ) : null}
                </div>

                <div className="flex items-start gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-bold text-crm-ink">{title(r.text)}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-crm-ink-3">
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-crm-warn text-crm-warn" />
                        {r.rating}
                      </span>
                      <span>{formatMoment(new Date(r.ts).toISOString())}</span>
                    </div>
                  </div>
                  {isOwner ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(r)}
                      disabled={busy}
                      title="Удалить отзыв"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={watch !== null} onClose={() => setWatch(null)} title="Видео-отзыв" wide>
        {watch ? (
          <video src={watch} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />
        ) : null}
      </Modal>
    </>
  );
}

/**
 * Подключение раздела к боту.
 *
 * Ключ спрашиваем ровно один раз и наружу больше не отдаём: показать его на
 * экране значит однажды показать на скриншоте. Проверяется он до сохранения —
 * иначе владелец увидел бы «сохранено» и пустой список.
 */
function Connect({
  isOwner,
  onDone,
}: {
  isOwner: boolean;
  onDone: (reviews: SiteReview[]) => void;
}) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOwner) {
    return (
      <Empty
        title="Раздел не подключён"
        hint="Подключить отзывы к боту может только владелец CRM."
      />
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.connectReviews(key.trim());
      onDone(result.reviews);
      toast("Отзывы подключены");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Не удалось подключить", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="max-w-xl" title="Подключение к боту">
        <ol className="mb-4 space-y-1.5 text-[13.5px] leading-relaxed text-crm-ink-2">
          <li>1. Откройте бота в Telegram и отправьте команду <b>/crm</b>.</li>
          <li>2. Скопируйте ключ из ответа.</li>
          <li>3. Вставьте его сюда — раздел заработает сразу.</li>
        </ol>
        <Field
          label="Ключ из бота"
          hint="Даёт право только смотреть и удалять отзывы. Заменить: команда «/crm новый»."
        >
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="например, 3f2a…"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="mt-4">
          <Link2 className="h-4 w-4" />
          Подключить
        </Button>
      </Card>
    </form>
  );
}
