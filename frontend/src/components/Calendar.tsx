import { useMemo, useState } from 'react';
import { useT } from '../i18n';

export interface CalEvent {
  id: string;
  title: string;
  startAt: string;
  variant?: 'lesson' | 'completed' | 'cancelled' | 'past' | 'free' | 'event';
}

interface Props {
  month: Date;
  events: CalEvent[];
  onDayClick?: (d: Date) => void;
  onEventClick?: (e: CalEvent) => void;
  /** Called when an event is dragged to another day. Receives event id and target date. */
  onEventMove?: (eventId: string, targetDay: Date) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function isPastDay(d: Date): boolean {
  return d < startOfToday();
}

export function MonthCalendar({ month, events, onDayClick, onEventClick, onEventMove }: Props) {
  const { t } = useT();
  const today = new Date();
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const days: { date: Date; outside: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - (startWeekday - i));
      days.push({ date: d, outside: true });
    }
    for (let i = 1; i <= last.getDate(); i++) {
      days.push({ date: new Date(month.getFullYear(), month.getMonth(), i), outside: false });
    }
    while (days.length % 7 !== 0) {
      const lastD = days[days.length - 1].date;
      const d = new Date(lastD);
      d.setDate(lastD.getDate() + 1);
      days.push({ date: d, outside: true });
    }
    return days;
  }, [month]);

  return (
    <div>
      <div className="calendar-grid" style={{ marginBottom: 4 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--text-soft)', padding: '4px 8px', fontWeight: 500 }}>
            {t(`calendar.weekday.${i}` as any)}
          </div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map(({ date, outside }, idx) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), date))
            .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
          const todayCls = isSameDay(date, today) ? 'today' : '';
          const past = isPastDay(date);
          const pastCls = past ? 'past-day' : '';
          const dayKey = date.toDateString();
          const dragOverCls = dragOverDay === dayKey ? 'drag-over' : '';
          return (
            <div
              key={idx}
              className={`cal-day ${outside ? 'other-month' : ''} ${todayCls} ${pastCls} ${dragOverCls}`}
              onClick={() => { if (!past) onDayClick && onDayClick(date); }}
              onDragOver={(e) => {
                if (!onEventMove || past) return;
                e.preventDefault();
                setDragOverDay(dayKey);
              }}
              onDragLeave={() => {
                if (dragOverDay === dayKey) setDragOverDay(null);
              }}
              onDrop={(e) => {
                if (!onEventMove || past) return;
                e.preventDefault();
                const eid = e.dataTransfer.getData('text/event-id');
                setDragOverDay(null);
                if (eid) onEventMove(eid, date);
              }}
              role={past ? undefined : 'button'}
              tabIndex={past ? -1 : 0}
            >
              <div className="num">{date.getDate()}</div>
              {dayEvents.slice(0, 4).map((e) => (
                <div
                  key={e.id}
                  className={`cal-event ${e.variant || 'lesson'}`}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick && onEventClick(e); }}
                  draggable={!!onEventMove}
                  onDragStart={(ev) => {
                    if (!onEventMove) return;
                    ev.dataTransfer.setData('text/event-id', e.id);
                    ev.dataTransfer.effectAllowed = 'move';
                  }}
                  title={`${new Date(e.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} ${e.title}`}
                >
                  {new Date(e.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} {e.title}
                </div>
              ))}
              {dayEvents.length > 4 && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>+{dayEvents.length - 4}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mobile-friendly agenda view: vertical list grouped by day.
 * Useful for ≤640px when the 7-column grid becomes hard to read.
 */
export function AgendaCalendar({ month, events, onDayClick, onEventClick, onEventMove }: Props) {
  const { t } = useT();
  const today = new Date();
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const days: Date[] = [];
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(month.getFullYear(), month.getMonth(), i));
    return days;
  }, [month]);

  return (
    <div className="agenda-list">
      {cells.map((d) => {
        const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), d))
          .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
        const isToday = isSameDay(d, today);
        const past = isPastDay(d);
        const wd = (d.getDay() + 6) % 7;
        return (
          <div key={d.toDateString()} className={`agenda-day ${isToday ? 'today' : ''} ${past ? 'past-day' : ''} ${dayEvents.length === 0 ? 'empty' : ''}`}
            onClick={() => { if (!past) onDayClick && onDayClick(d); }}>
            <div className="agenda-date">
              <div className="agenda-num">{d.getDate()}</div>
              <div className="agenda-wd">{t(`calendar.weekday.${wd}` as any)}</div>
            </div>
            <div className="agenda-events">
              {dayEvents.length === 0 && <div className="muted" style={{ fontSize: 12 }}>—</div>}
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className={`agenda-event ${e.variant || 'lesson'}`}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick && onEventClick(e); }}
                  draggable={!!onEventMove}
                  onDragStart={(ev) => {
                    if (!onEventMove) return;
                    ev.dataTransfer.setData('text/event-id', e.id);
                  }}
                >
                  <span className="agenda-time">
                    {new Date(e.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="agenda-title">{e.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Auto-pick: month grid for ≥640px, agenda list for narrower screens. */
export function ResponsiveCalendar(props: Props) {
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useMemoOnResize(() => setIsNarrow(window.innerWidth < 640));
  return isNarrow ? <AgendaCalendar {...props} /> : <MonthCalendar {...props} />;
}

function useMemoOnResize(cb: () => void) {
  // Re-trigger on window resize so isNarrow stays in sync
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => {
    const onResize = () => cb();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
}
