import { courseDirections } from "~/shared/course-registry";
import { readLeadPrograms } from "~/shared/lead-context";

export const LMS_LEGACY_DIRECTIONS = [
  {
    id: "ohrana-truda",
    ru: "Охрана труда",
    kk: "Еңбекті қорғау",
    aliases: ["biot", "labor-safety"],
  },
  {
    id: "promyshlennaya-bezopasnost",
    ru: "Промышленная безопасность",
    kk: "Өнеркәсіптік қауіпсіздік",
    aliases: ["prombez", "industrial-safety"],
  },
  {
    id: "ptm",
    ru: "Пожарно-технический минимум",
    kk: "Өрт-техникалық минимум",
    aliases: ["fire-safety"],
  },
  {
    id: "elektrobezopasnost",
    ru: "Электробезопасность",
    kk: "Электр қауіпсіздігі",
    aliases: [],
  },
  {
    id: "raboty-na-vysote",
    ru: "Работы на высоте",
    kk: "Биіктіктегі жұмыстар",
    aliases: [],
  },
  {
    id: "gpm-stropalschiki",
    ru: "Грузоподъёмные краны и стропальные работы",
    kk: "Жүк көтергіш крандар және жүкті ілмектеу",
    aliases: [],
  },
  {
    id: "gazoopasnye-raboty",
    ru: "Газоопасные работы",
    kk: "Газ қауіпті жұмыстар",
    aliases: [],
  },
  {
    id: "ekologicheskaya-bezopasnost",
    ru: "Экологическая безопасность",
    kk: "Экологиялық қауіпсіздік",
    aliases: [],
  },
  {
    id: "pervaya-pomoshch",
    ru: "Первая помощь",
    kk: "Алғашқы көмек",
    aliases: [],
  },
];
export const LMS_DIRECTIONS = courseDirections.map((direction) => ({
  id: direction.id,
  ru: direction.title.ru,
  kk: direction.title.kk,
  aliases:
    LMS_LEGACY_DIRECTIONS.find((item) => item.id === direction.id)?.aliases ||
    [],
}));
export function useLmsSelection() {
  const defaults = () => ({
    direction: "",
    directionIds: [] as string[],
    role: "",
    industry: "",
    format: "online",
    city: "",
  });
  const selection = useCookie<{
    direction: string;
    directionIds: string[];
    role: string;
    industry: string;
    format: string;
    city: string;
  }>("ot-center-selection-v1", {
    default: defaults,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  if (
    !selection.value ||
    typeof selection.value !== "object" ||
    Array.isArray(selection.value)
  )
    selection.value = defaults();
  // Migrate the existing single-choice cookie without losing the other steps.
  const normalizeDirections = (values: unknown) => {
    const items = Array.isArray(values) ? values : [];
    return [...new Set(items.flatMap((value) => {
      const match = LMS_DIRECTIONS.find((direction) => direction.id === value || direction.aliases.includes(value));
      return match ? [match.id] : [];
    }))].slice(0, LMS_DIRECTIONS.length);
  };
  const initialDirections = normalizeDirections(Array.isArray(selection.value.directionIds)
    ? selection.value.directionIds : [selection.value.direction]);
  selection.value = { ...defaults(), ...selection.value, directionIds: initialDirections, direction: initialDirections[0] || "" };
  const setDirections = (values: string[]) => {
    const directionIds = normalizeDirections(values);
    selection.value = { ...selection.value, directionIds, direction: directionIds[0] || "" };
  };
  const toggleDirection = (id: string) => {
    const selected = selection.value.directionIds;
    setDirections(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  };
  // Several mounted components read the same route. A city/language change
  // must not reapply an unchanged prefill over the user's edited selection.
  const appliedDirectionQuery = useState<string | null>('ot-selection-direction-query', () => null);
  const appliedFormatQuery = useState<string | null>('ot-selection-format-query', () => null);
  const set = (
    key: "direction" | "role" | "industry" | "format" | "city",
    value: string,
  ) => {
    if (key === "direction") { setDirections([value]); return; }
    selection.value = { ...selection.value, [key]: value.slice(0, 80) };
  };
  const fromQuery = (query: Record<string, any>) => {
    let queryDirections: string[] | null = null;
    if (Object.hasOwn(query, 'programs') || Object.hasOwn(query, 'program')) {
      queryDirections = readLeadPrograms(query);
    } else {
      const key = typeof query.direction === 'string' ? query.direction
        : typeof query.slug === 'string' ? query.slug : '';
      const match = LMS_DIRECTIONS.find(direction => direction.id === key || direction.aliases.includes(key));
      if (match) queryDirections = [match.id];
    }
    const queryKey = queryDirections === null ? null : JSON.stringify(queryDirections);
    if (queryKey !== appliedDirectionQuery.value) {
      appliedDirectionQuery.value = queryKey;
      if (queryDirections !== null) setDirections(queryDirections);
    }
    const queryFormat = typeof query.format === "string" &&
      ["online", "classroom", "onsite"].includes(query.format) ? query.format : null;
    if (queryFormat !== appliedFormatQuery.value) {
      appliedFormatQuery.value = queryFormat;
      if (queryFormat !== null) set("format", queryFormat);
    }
    if (typeof query.city === "string" && isValidCitySlug(query.city))
      set("city", query.city);
  };
  return { selection, set, setDirections, toggleDirection, fromQuery, directions: LMS_DIRECTIONS };
}
