import { useMemo } from 'react';

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
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function MonthCalendar({ month, events, onDayClick, onEventClick }: Props) {
  const today = new Date();
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // ISO Monday
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
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <div key={d} style={{ fontSize: 12, color: 'var(--text-soft)', padding: '4px 8px', fontWeight: 500 }}>{d}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map(({ date, outside }, idx) => {
          const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), date))
            .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
          const todayCls = isSameDay(date, today) ? 'today' : '';
          return (
            <div
              key={idx}
              className={`cal-day ${outside ? 'other-month' : ''} ${todayCls}`}
              onClick={() => onDayClick && onDayClick(date)}
              role="button"
              tabIndex={0}
            >
              <div className="num">{date.getDate()}</div>
              {dayEvents.slice(0, 4).map((e) => (
                <div
                  key={e.id}
                  className={`cal-event ${e.variant || 'lesson'}`}
                  onClick={(ev) => { ev.stopPropagation(); onEventClick && onEventClick(e); }}
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
