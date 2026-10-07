// Editors can choose relevant published articles for any direction explicitly.
export const preferredCourseArticles = {
  'ohrana-truda': [
    'biot-novye-pravila-2026-2027',
    'plan-obucheniya-personala-2027',
    'udostoverenie-ohrana-truda-proverka-kazakhstan',
  ],
};

export function selectCourseArticles(posts, directionId, limit = 3) {
  const selected = (preferredCourseArticles[directionId] || [])
    .map(slug => posts.find(post => post.slug === slug)).filter(Boolean);
  return [...new Map([...selected, ...posts.filter(post => post.relatedCourses?.includes(directionId))]
    .map(post => [post.slug, post])).values()].slice(0, limit);
}
