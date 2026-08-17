import { Card } from "@/components/ui/card";
import { COURSES, TEE_CONFIG, type TeeColor } from "@/lib/courses";
import fieldMap from "@/assets/course-map/field-map.webp";

const LEGEND_AREAS: { label: string; color: string }[] = [
  { label: "Раф", color: "#5c7a3f" },
  { label: "Фервей", color: "#8bb85a" },
  { label: "Грин", color: "#c8dd8e" },
  { label: "Деревья", color: "#2f4a23" },
  { label: "Озеро", color: "#4f83b0" },
];

const LEGEND_MARKS = [
  "Ти-маркеры",
  "Границы академического поля",
  "Границы чемпионского 18-луночного поля",
  "Дорожки, дороги",
];

const TEE_ORDER: TeeColor[] = ["black", "white", "yellow", "blue", "red"];

const ScorecardTable = ({ courseId }: { courseId: string }) => {
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) return null;
  const tees = TEE_ORDER.filter((color) => course.tees.some((t) => t.color === color));

  return (
    <Card className="overflow-hidden shadow-soft">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border flex items-baseline justify-between">
        <div className="font-bold text-sm text-foreground">{course.name} Course</div>
        <div className="text-xs text-muted-foreground">Par {course.totalPar}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="bg-muted/30 border-b border-border">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground sticky left-0 bg-background">Hole</th>
              {course.holes.map((h) => (
                <th key={h.number} className="px-2 py-2 font-semibold text-muted-foreground text-center">{h.number}</th>
              ))}
              <th className="px-3 py-2 font-semibold text-muted-foreground text-center">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-3 py-1.5 text-muted-foreground sticky left-0 bg-background">Par</td>
              {course.holes.map((h) => (
                <td key={h.number} className="px-2 py-1.5 text-center text-action font-semibold">{h.par}</td>
              ))}
              <td className="px-3 py-1.5 text-center font-semibold">{course.totalPar}</td>
            </tr>
            <tr>
              <td className="px-3 py-1.5 text-muted-foreground sticky left-0 bg-background">Index</td>
              {course.holes.map((h) => (
                <td key={h.number} className="px-2 py-1.5 text-center text-muted-foreground">{h.hcp}</td>
              ))}
              <td className="px-3 py-1.5" />
            </tr>
            {tees.map((color) => {
              const tee = course.tees.find((t) => t.color === color)!;
              return (
                <tr key={color}>
                  <td className="px-3 py-1.5 font-semibold sticky left-0 bg-background">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/10 shrink-0"
                        style={{ background: tee.cssColor }}
                      />
                      {tee.label}
                    </span>
                  </td>
                  {course.holes.map((h) => (
                    <td key={h.number} className="px-2 py-1.5 text-center">{h.meters[color]}</td>
                  ))}
                  <td className="px-3 py-1.5 text-center font-semibold">{tee.totalMeters}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

const CoursePage = () => {
  const championship = COURSES.find((c) => c.id === "championship")!;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground font-semibold">Golf Club Minsk</div>
        <h1 className="text-2xl font-bold mt-1">Карта полей</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {championship.address} · архитектор {championship.designer}
        </p>
      </div>

      <Card className="p-5 shadow-soft text-sm text-muted-foreground leading-relaxed">
        Гольф-клуб Минск занимает более 70 га и включает чемпионское 18-луночное поле
        международного класса (пар 72), академическое 9-луночное поле (пар 27),
        тренировочное поле с двумя драйвинг-рейнджами, двумя паттинг-гринами и чиппинг-грином,
        а также гольф-симулятор.
      </Card>

      <Card className="overflow-hidden shadow-soft">
        <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
          <div className="font-bold text-sm text-foreground">Топографическая карта</div>
        </div>
        <div className="overflow-x-auto">
          <img src={fieldMap} alt="Карта полей Golf Club Minsk" className="min-w-[900px] w-full" />
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs text-muted-foreground border-t border-border">
          {LEGEND_AREAS.map((a) => (
            <div key={a.label} className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: a.color }} />
              {a.label}
            </div>
          ))}
          {LEGEND_MARKS.map((m) => (
            <div key={m} className="flex items-center gap-2">
              <span className="h-px w-3 bg-muted-foreground shrink-0" />
              {m}
            </div>
          ))}
        </div>
      </Card>

      <ScorecardTable courseId="championship" />
      <ScorecardTable courseId="academy" />
    </div>
  );
};

export default CoursePage;
