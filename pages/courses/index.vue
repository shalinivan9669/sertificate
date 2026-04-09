<script setup>
import { computed } from 'vue';

definePageMeta({ layout: 'fullwidth' });

useHead({
  title: 'Каталог курсов — OT Center',
  meta: [
    { name: 'description', content: 'Каталог программ обучения по промышленной безопасности, охране труда и пожарной безопасности в Казахстане.' },
  ],
});

const { paths, selection, patchSelection, syncCourseId } = useRedesignRoutes();

syncCourseId();

const courseDirectory = {
  'industrial-safety': {
    direction: 'prombez',
    title: 'Промышленная безопасность',
    badge: 'Industrial Safety',
  },
  'labor-safety': {
    direction: 'biot',
    title: 'Охрана труда',
    badge: 'Labor Safety',
  },
  'fire-safety': {
    direction: 'ptm',
    title: 'Пожарная безопасность',
    badge: 'Fire Safety',
  },
};

const selectedCourse = computed(() => courseDirectory[selection.value.courseId] || courseDirectory['industrial-safety']);

const openCourse = (slug) => {
  const course = courseDirectory[slug];

  if (course) {
    patchSelection({
      courseId: slug,
      direction: course.direction,
    });
    syncCourseId();
  }

  navigateTo(`/courses/${slug}`);
};
</script>

<template>
<!-- TopNavBar (Shared Component) -->
<header class="bg-[#0A192F] sticky top-0 z-50 shadow-[0_40px_40px_rgba(10,25,47,0.06)]">
<div class="flex justify-between items-center w-full px-8 py-4 max-w-screen-2xl mx-auto">
<div class="flex items-center gap-8">
<span class="text-2xl font-extrabold tracking-tighter text-white">Sertificat.kz</span>
<nav class="hidden md:flex gap-6">
<NuxtLink class="text-white border-b-2 border-[#4A90E2] pb-1 hover:text-[#4A90E2] transition-colors duration-200" :to="paths.courses">Catalog</NuxtLink>
<NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.categories">Accreditation</NuxtLink>
<NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.cabinet">Check Certificate</NuxtLink>
<NuxtLink class="text-slate-400 font-medium hover:text-[#4A90E2] transition-colors duration-200" :to="paths.contacts">About</NuxtLink>
</nav>
</div>
<div class="flex items-center gap-4">
<button class="text-slate-400 p-2 hover:text-[#4A90E2] transition-colors duration-200" @click="navigateTo(paths.cabinet)">
<span class="material-symbols-outlined">account_circle</span>
</button>
<button class="bg-[#4A90E2] text-white px-6 py-2 rounded-lg font-bold text-sm tracking-wide hover:brightness-110 transition-all" @click="navigateTo(paths.cabinet)">Login</button>
</div>
</div>
</header>
<div class="max-w-screen-2xl mx-auto flex min-h-screen">
<!-- Left Sidebar Filters -->
<aside class="w-72 bg-surface flex-shrink-0 border-r border-outline-variant/20 p-8 hidden lg:block">
<div class="space-y-8">
<div>
<h3 class="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-6">Direction</h3>
<div class="space-y-3">
<label class="flex items-center gap-3 cursor-pointer group">
<input checked="" class="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox"/>
<span class="text-sm font-medium group-hover:text-secondary transition-colors">Industrial Safety</span>
</label>
<label class="flex items-center gap-3 cursor-pointer group">
<input class="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox"/>
<span class="text-sm font-medium group-hover:text-secondary transition-colors">Occupational Health</span>
</label>
<label class="flex items-center gap-3 cursor-pointer group">
<input class="w-4 h-4 rounded border-outline-variant text-secondary focus:ring-secondary" type="checkbox"/>
<span class="text-sm font-medium group-hover:text-secondary transition-colors">Fire Safety</span>
</label>
</div>
</div>
<div>
<h3 class="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-6">Type</h3>
<div class="space-y-3">
<label class="flex items-center gap-3 cursor-pointer">
<input class="w-4 h-4 border-outline-variant text-secondary focus:ring-secondary" name="type" type="radio"/>
<span class="text-sm font-medium">Certification</span>
</label>
<label class="flex items-center gap-3 cursor-pointer">
<input class="w-4 h-4 border-outline-variant text-secondary focus:ring-secondary" name="type" type="radio"/>
<span class="text-sm font-medium">Re-certification</span>
</label>
</div>
</div>
<div>
<h3 class="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-6">Industry</h3>
<select class="w-full bg-surface-container-low border-none rounded-lg text-sm font-medium p-3 focus:ring-2 focus:ring-secondary">
<option>Oil &amp; Gas</option>
<option>Mining</option>
<option>Construction</option>
<option>Power Generation</option>
</select>
</div>
<div>
<h3 class="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-6">Format</h3>
<div class="flex flex-wrap gap-2">
<button class="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold bg-white text-on-surface hover:border-secondary transition-colors">Online</button>
<button class="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold bg-white text-on-surface hover:border-secondary transition-colors">On-site</button>
<button class="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-xs font-semibold bg-white text-on-surface hover:border-secondary transition-colors">Hybrid</button>
</div>
</div>
<div>
<h3 class="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-6">Price Range</h3>
<div class="space-y-4">
<input class="w-full h-1 bg-outline-variant/30 appearance-none cursor-pointer accent-secondary" type="range"/>
<div class="flex justify-between text-xs font-mono text-on-surface-variant">
<span>0 ₸</span>
<span>500,000 ₸</span>
</div>
</div>
</div>
</div>
</aside>
<!-- Main Content -->
<main class="flex-1 p-8 overflow-y-auto">
<!-- Top Search & Sorting -->
<div class="flex flex-col md:flex-row gap-6 items-center justify-between mb-10 pb-8 border-b border-outline-variant/10">
<div class="relative w-full md:max-w-xl">
<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
<input class="w-full pl-12 pr-4 py-4 bg-surface-container-low border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-secondary" type="text" value="Industrial safety oil &amp; gas"/>
</div>
<div class="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
<span class="text-sm font-semibold text-on-surface-variant"><span class="text-on-surface">128</span> Results Found</span>
<div class="flex items-center gap-2">
<span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Sort by:</span>
<select class="bg-transparent border-none text-sm font-bold text-secondary focus:ring-0 p-0 pr-6">
<option>Popularity</option>
<option>Price: Low to High</option>
<option>Newest</option>
</select>
</div>
</div>
</div>
<div class="mb-8 rounded-2xl border border-[#4A90E2]/20 bg-[#0A192F] px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
<div>
<div class="text-[10px] uppercase tracking-[0.22em] text-slate-400 mb-1">Current course context</div>
<div class="text-white font-bold">{{ selectedCourse.title }}</div>
</div>
<div class="text-sm text-slate-300">Course flow is pinned to <span class="text-[#8ec1ff] font-semibold">{{ selection.courseId }}</span>.</div>
</div>
<!-- Program Grid -->
<div class="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
<!-- Card 1 -->
<div class="group bg-surface-container-lowest border border-outline-variant/15 rounded-xl overflow-hidden hover:shadow-[0_20px_50px_rgba(10,25,47,0.08)] transition-all duration-300 flex flex-col h-full">
<div class="relative h-48 overflow-hidden">
<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="dramatic industrial shot of oil refinery at dusk with complex piping and golden atmospheric lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5X97zU-lnewoMtgshwJMVrvz6DzCuI52kx2ImHd_mRwjmdsT4NBF7xnA3G7nA705CBw_psulbBHaBdQl_mu_uzE9zFPFKzKNgOKdVdSTQLQSPW1FPVNB6VFjWoVMjblpXVr4k7M47h1ldlTgcsNV_o4Y7veWBFdJcSUtzGjUVnDW5nWwZWk0KVQWBkOM33ES69wLtYrZyYIoKz5Knuy064E8ukVWqcr7OEH8-ayulQCxenDh9Kr1frystiI5x0oxjfbhmmRYyZYeR"/>
<div class="absolute top-4 left-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest">Oil &amp; Gas Sector</div>
</div>
<div class="p-6 flex-1 flex flex-col">
<div class="flex items-center gap-2 mb-3">
<span class="text-[10px] font-mono text-on-surface-variant">ID: IS-OG-2024</span>
<div class="h-1 w-1 rounded-full bg-outline-variant"></div>
<span class="text-[10px] font-mono text-on-surface-variant">Valid for 3 years</span>
</div>
<h2 class="text-xl font-extrabold leading-tight mb-4 group-hover:text-secondary transition-colors">Аттестация ИТР на опасных производственных объектах нефтегазовой отрасли</h2>
<div class="grid grid-cols-2 gap-4 mb-8">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">schedule</span>
<span class="text-xs font-semibold text-on-surface-variant">40 Hours</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">verified</span>
<span class="text-xs font-semibold text-on-surface-variant">State Diploma</span>
</div>
</div>
<div class="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
<div class="flex flex-col">
<span class="text-[10px] uppercase font-bold text-on-surface-variant tracking-tighter">Full Course Price</span>
<span class="text-2xl font-black text-on-surface">125,000 ₸</span>
</div>
<div class="flex gap-2">
<button class="p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-secondary hover:bg-secondary-container transition-colors" @click="openCourse('industrial-safety')">
<span class="material-symbols-outlined">info</span>
</button>
<button class="px-6 py-3 bg-[#0A192F] text-white rounded-lg font-bold text-xs tracking-wide hover:brightness-125 transition-all" @click="openCourse('industrial-safety')">Start Training</button>
</div>
</div>
</div>
</div>
<!-- Card 2 -->
<div class="group bg-surface-container-lowest border border-outline-variant/15 rounded-xl overflow-hidden hover:shadow-[0_20px_50px_rgba(10,25,47,0.08)] transition-all duration-300 flex flex-col h-full">
<div class="relative h-48 overflow-hidden">
<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="close-up of industrial engineer wearing protective helmet and high-visibility vest inspecting technical blueprints" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7jFgMjWNNiYsidlkq2Xc8-Adsx70NrQNgt3xFkBoALre8yOBwS8dKfPQkyMvMmXL9ui-lBqOXhERwwVAMh28x2kOjG2sKw-3NRzBr7Ba1bWAHvfs3yr4Xeb8mcgyjTKzgApFPPQClJUSx6n75tzv8ri3omFuIUJ0HvjBrxxbuzkMW-kXYSHRbC5fr81l15ANkqjsky9PJrfg8uRzF82zZlXMJo3CJb1dwO90TBL1wRVCwLDhXdHeuQrrXijh9JlrY6tWX2GaCuooP"/>
<div class="absolute top-4 left-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest">Work Safety</div>
</div>
<div class="p-6 flex-1 flex flex-col">
<div class="flex items-center gap-2 mb-3">
<span class="text-[10px] font-mono text-on-surface-variant">ID: WS-GP-5512</span>
<div class="h-1 w-1 rounded-full bg-outline-variant"></div>
<span class="text-[10px] font-mono text-on-surface-variant">Valid for 1 year</span>
</div>
<h2 class="text-xl font-extrabold leading-tight mb-4 group-hover:text-secondary transition-colors">Safety Officer Advanced Certification: Industrial Complexes</h2>
<div class="grid grid-cols-2 gap-4 mb-8">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">schedule</span>
<span class="text-xs font-semibold text-on-surface-variant">72 Hours</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">public</span>
<span class="text-xs font-semibold text-on-surface-variant">Online / Hybrid</span>
</div>
</div>
<div class="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
<div class="flex flex-col">
<span class="text-[10px] uppercase font-bold text-on-surface-variant tracking-tighter">Full Course Price</span>
<span class="text-2xl font-black text-on-surface">85,000 ₸</span>
</div>
<div class="flex gap-2">
<button class="p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-secondary hover:bg-secondary-container transition-colors" @click="openCourse('labor-safety')">
<span class="material-symbols-outlined">info</span>
</button>
<button class="px-6 py-3 bg-[#0A192F] text-white rounded-lg font-bold text-xs tracking-wide hover:brightness-125 transition-all" @click="openCourse('labor-safety')">Start Training</button>
</div>
</div>
</div>
</div>
<!-- Card 3 -->
<div class="group bg-surface-container-lowest border border-outline-variant/15 rounded-xl overflow-hidden hover:shadow-[0_20px_50px_rgba(10,25,47,0.08)] transition-all duration-300 flex flex-col h-full">
<div class="relative h-48 overflow-hidden">
<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="aerial view of heavy machinery operating in a large open-pit mine with deep shadows and high contrast" src="https://lh3.googleusercontent.com/aida-public/AB6AXuACSSk7QIyqZJlxQ3KNh9rVcpPFRVqh0eZTMZdZblOh4kuTVIqS8k5SGFquNbWJa4cSjmQDcwprlAjKYol5dNyHN2hsg-NR-AoKw2MBYjjy82VQ1C2NYUKD0uvC2ANhz66fYsQXORQVgwHEA83RVqoa4ToZyhY7S7TcUsPOcnoy76RD9eYkjDW8-hytJH1INi9pFXu3c63-Gqu63LZdKPUtKhRGsAyJ2kwjAVJwZ7PmdxWT06yy3Yho7KYX3_6CLNh3rJiLKxyHbSX7"/>
<div class="absolute top-4 left-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest">Mining Operations</div>
</div>
<div class="p-6 flex-1 flex flex-col">
<div class="flex items-center gap-2 mb-3">
<span class="text-[10px] font-mono text-on-surface-variant">ID: MO-KZ-9920</span>
<div class="h-1 w-1 rounded-full bg-outline-variant"></div>
<span class="text-[10px] font-mono text-on-surface-variant">Valid for 3 years</span>
</div>
<h2 class="text-xl font-extrabold leading-tight mb-4 group-hover:text-secondary transition-colors">Industrial Safety Management for Mining and Smelting</h2>
<div class="grid grid-cols-2 gap-4 mb-8">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">schedule</span>
<span class="text-xs font-semibold text-on-surface-variant">120 Hours</span>
</div>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-lg">military_tech</span>
<span class="text-xs font-semibold text-on-surface-variant">Expert Level</span>
</div>
</div>
<div class="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
<div class="flex flex-col">
<span class="text-[10px] uppercase font-bold text-on-surface-variant tracking-tighter">Full Course Price</span>
<span class="text-2xl font-black text-on-surface">195,000 ₸</span>
</div>
<div class="flex gap-2">
<button class="p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-secondary hover:bg-secondary-container transition-colors" @click="openCourse('industrial-safety')">
<span class="material-symbols-outlined">info</span>
</button>
<button class="px-6 py-3 bg-[#0A192F] text-white rounded-lg font-bold text-xs tracking-wide hover:brightness-125 transition-all" @click="openCourse('industrial-safety')">Start Training</button>
</div>
</div>
</div>
</div>
<!-- Bento Style Feature Card (Asymmetric Layout) -->
<div class="xl:col-span-2 2xl:col-span-3 bg-[#0A192F] rounded-2xl p-10 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
<div class="z-10 flex-1">
<span class="text-secondary font-bold text-xs uppercase tracking-widest mb-4 block">New Requirement 2024</span>
<h3 class="text-4xl font-extrabold text-white leading-tight mb-6 max-w-xl">Mandatory Offshore Safety Induction &amp; Emergency Training (BOSIET)</h3>
<p class="text-slate-400 text-sm leading-relaxed mb-8 max-w-lg">Fully accredited by international maritime bodies. Prepare your team for Caspian offshore operations with our new simulation-based certification program.</p>
<div class="flex gap-4">
<button class="bg-white text-[#0A192F] px-8 py-3 rounded-lg font-bold text-sm tracking-wide hover:bg-slate-200 transition-all" @click="openCourse('industrial-safety')">Enroll Now</button>
<button class="border border-white/20 text-white px-8 py-3 rounded-lg font-bold text-sm tracking-wide hover:bg-white/10 transition-all" @click="openCourse('industrial-safety')">Download Syllabus</button>
</div>
</div>
<div class="w-full md:w-1/3 aspect-video md:aspect-square relative z-10">
<img class="w-full h-full object-cover rounded-xl shadow-2xl" data-alt="professional industrial simulator used for offshore safety training with computer screens and complex hardware" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQzPZkgMLwqiBKRRzo4gcKAyAiCmr5HjShAkn49ahuMmniC75nha6epZ0X00CtvTEeTFHzcZUku8sgC3huukEOY527eGAMly3BnPAkf6m8TnG7DHPsCmviOrIzqrNAwYhP2syaSily0pcgPH6BC_8Ngym0edrjLC5jUugbGCiDYjxAbeIqRMipVL5i5lhR_GMJt_Wer2UPQ11NGhaPtQP-3Wp1q-mor6GMstNjlLERGeNTlC9uY2UOE0rIg9DSr5DlO1hI9D-SIPQm"/>
</div>
<!-- Decorative Element -->
<div class="absolute -bottom-20 -right-20 w-96 h-96 bg-secondary/10 rounded-full blur-[100px]"></div>
</div>
<!-- More cards... -->
<!-- Card 4 (Condensed) -->
<div class="group bg-surface-container-lowest border border-outline-variant/15 rounded-xl overflow-hidden hover:shadow-[0_20px_50px_rgba(10,25,47,0.08)] transition-all duration-300 flex flex-col h-full">
<div class="relative h-48 overflow-hidden">
<img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" data-alt="construction worker in high-vis gear pointing at safety signage in a high-contrast industrial setting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDa1M4VAcY7COvKY701cwUX7A01qiWwxsd0uY64mX_Wr-S_eSMk3iaR2mHftLOsJtZeXxLu2-Q51Tvojtle9I-6iU_fNJEs3_R-V-2F_VbuthOvzsidWeARdgB40eVA8M_GvyBPvRV6-BBjvFQg0g43Y729AjKYMrv6EWARaQpvJLID70MHt8X8dPFyPxCqmMo_iHgrTny_4mB1BUS0LFQ6f86Uz0i1pzEvMm9z7qpB-hfx4sJg0zqmYWb91UsGHsquPNdkKnOMRO3y"/>
<div class="absolute top-4 left-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest">Fire Safety</div>
</div>
<div class="p-6 flex-1 flex flex-col">
<div class="flex items-center gap-2 mb-3">
<span class="text-[10px] font-mono text-on-surface-variant">ID: FS-EX-101</span>
<div class="h-1 w-1 rounded-full bg-outline-variant"></div>
<span class="text-[10px] font-mono text-on-surface-variant">Valid for 3 years</span>
</div>
<h2 class="text-xl font-extrabold leading-tight mb-4 group-hover:text-secondary transition-colors">Technical Personnel: Fire Safety &amp; Prevention Protocol</h2>
<div class="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
<div class="flex flex-col">
<span class="text-[10px] uppercase font-bold text-on-surface-variant tracking-tighter">Full Course Price</span>
<span class="text-2xl font-black text-on-surface">55,000 ₸</span>
</div>
<div class="flex gap-2">
<button class="p-3 bg-surface-container border border-outline-variant/30 rounded-lg text-secondary hover:bg-secondary-container transition-colors" @click="openCourse('fire-safety')">
<span class="material-symbols-outlined">info</span>
</button>
<button class="px-6 py-3 bg-[#0A192F] text-white rounded-lg font-bold text-xs tracking-wide hover:brightness-125 transition-all" @click="openCourse('fire-safety')">Start Training</button>
</div>
</div>
</div>
</div>
</div>
</main>
</div>
<!-- Footer (Shared Component) -->
<footer class="bg-[#0A192F] border-t border-white/5 mt-20">
<div class="w-full py-12 px-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-screen-2xl mx-auto">
<div class="space-y-6">
<span class="text-xl font-black text-white">Sertificat.kz</span>
<p class="text-slate-400 text-xs max-w-sm leading-relaxed">© 2024 Industrial Safety Certification Center Kazakhstan. All rights reserved. Leading provider of accredited training solutions for the energy and manufacturing sectors.</p>
</div>
<div class="grid grid-cols-2 gap-8">
<div class="space-y-4">
<h4 class="text-white text-xs font-bold uppercase tracking-widest">Platform</h4>
<ul class="space-y-2">
<li><NuxtLink class="text-slate-400 text-xs hover:underline transition-all" :to="paths.privacy">Privacy Policy</NuxtLink></li>
<li><NuxtLink class="text-slate-400 text-xs hover:underline transition-all" :to="paths.publicOffer">Terms of Service</NuxtLink></li>
</ul>
</div>
<div class="space-y-4">
<h4 class="text-white text-xs font-bold uppercase tracking-widest">Support</h4>
<ul class="space-y-2">
<li><NuxtLink class="text-slate-400 text-xs hover:underline transition-all" :to="paths.licenses">Accreditation Details</NuxtLink></li>
<li><NuxtLink class="text-slate-400 text-xs hover:underline transition-all" :to="paths.contacts">Contact Support</NuxtLink></li>
</ul>
</div>
</div>
</div>
</footer>
</template>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block;
}
</style>
