import { courseDirections } from "~/shared/course-registry";

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
    role: "",
    industry: "",
    format: "online",
    city: "",
  });
  const selection = useCookie<{
    direction: string;
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
  const set = (
    key: "direction" | "role" | "industry" | "format" | "city",
    value: string,
  ) => {
    selection.value = { ...selection.value, [key]: value.slice(0, 80) };
  };
  const fromQuery = (query: Record<string, any>) => {
    const key =
      typeof query.direction === "string"
        ? query.direction
        : typeof query.slug === "string"
          ? query.slug
          : "";
    const match = LMS_DIRECTIONS.find(
      (d) => d.id === key || d.aliases.includes(key),
    );
    if (match) set("direction", match.id);
    if (
      typeof query.format === "string" &&
      ["online", "classroom", "onsite"].includes(query.format)
    )
      set("format", query.format);
    if (typeof query.city === "string" && isValidCitySlug(query.city))
      set("city", query.city);
  };
  return { selection, set, fromQuery, directions: LMS_DIRECTIONS };
}
